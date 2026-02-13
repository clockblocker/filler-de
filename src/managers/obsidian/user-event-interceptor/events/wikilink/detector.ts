/**
 * WikilinkDetector - detects wikilink completions with handler pattern.
 *
 * Detects two scenarios:
 * 1. Cursor right after ]] (user typed closing brackets manually)
 * 2. Selection wrapped in [[...]] (user selected text and typed [ twice,
 *    Obsidian auto-wraps selection in brackets each time)
 *
 * Uses registerEditorExtension which persists until plugin unload.
 *
 * Skips:
 * - Links that already have an alias (contain |)
 * - Nested wikilinks
 * - Empty link content
 */

import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { Plugin } from "obsidian";
import { HandlerOutcome } from "../../types/handler";
import { PayloadKind } from "../../types/payload-base";
import type { HandlerInvoker } from "../../user-event-interceptor";
import { WikilinkCodec } from "./codec";
import type { WikilinkPayload } from "./payload";

export class WikilinkDetector {
	private extension: ReturnType<typeof EditorView.updateListener.of> | null =
		null;
	private listening = false;
	private readonly invoker: HandlerInvoker<WikilinkPayload>;

	constructor(
		private readonly plugin: Plugin,
		createInvoker: (kind: PayloadKind) => HandlerInvoker<WikilinkPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.WikilinkCompleted);
	}

	startListening(): void {
		this.listening = true;

		// Only register extension once (persists until plugin unload)
		if (this.extension) return;

		this.extension = EditorView.updateListener.of((vu: ViewUpdate) => {
			this.handleUpdate(vu);
		});

		this.plugin.registerEditorExtension(this.extension);
	}

	stopListening(): void {
		// Can't unregister extension, but stop processing
		this.listening = false;
	}

	// ─── Private ───

	private handleUpdate(vu: ViewUpdate): void {
		if (!this.listening) return;
		if (!vu.docChanged) return;

		const detected =
			this.detectCursorAfterClose(vu) ?? this.detectWrappedSelection(vu);

		if (!detected) return;

		const { closePos, linkContent } = detected;

		const payload = WikilinkCodec.encode({
			closePos,
			linkContent,
			view: vu.view,
		});

		const { applies, invoke } = this.invoker(payload);

		if (!applies) return;

		void invoke().then((result) => {
			if (result.outcome === HandlerOutcome.Modified && result.data) {
				if (result.data.resolvedTarget) {
					WikilinkCodec.replaceTarget(result.data);
				} else {
					WikilinkCodec.insertAlias(result.data);
				}
			}
		});
	}

	/** Case 1: cursor positioned right after ]] (manual typing) */
	private detectCursorAfterClose(
		vu: ViewUpdate,
	): { closePos: number; linkContent: string } | null {
		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();

		if (text.slice(cursor - 2, cursor) !== "]]") return null;

		const closePos = cursor - 2;
		return this.extractLinkContent(text, closePos);
	}

	/** Case 2: selection wrapped in [[...]] (Obsidian bracket-wraps selected text) */
	private detectWrappedSelection(
		vu: ViewUpdate,
	): { closePos: number; linkContent: string } | null {
		const sel = vu.state.selection.main;
		if (sel.from === sel.to) return null; // no selection

		const text = vu.state.doc.toString();

		if (text.slice(sel.from - 2, sel.from) !== "[[") return null;
		if (text.slice(sel.to, sel.to + 2) !== "]]") return null;

		const closePos = sel.to;
		return this.extractLinkContent(text, closePos);
	}

	/** Validate and extract link content from text ending at closePos */
	private extractLinkContent(
		text: string,
		closePos: number,
	): { closePos: number; linkContent: string } | null {
		const openPos = text.lastIndexOf("[[", closePos);
		if (openPos === -1) return null;

		const between = text.slice(openPos + 2, closePos);

		if (between.includes("[[")) return null;
		if (between.includes("|")) return null;

		const linkContent = between.trim();
		if (!linkContent) return null;

		return { closePos, linkContent };
	}
}
