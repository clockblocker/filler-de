/**
 * WikilinkDetector - detects wikilink completions with handler pattern.
 *
 * Emits WikilinkPayload when user completes a wikilink (cursor right after ]]).
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
		// Guard: only process when listening
		if (!this.listening) return;

		if (!vu.docChanged) return;

		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();
		const charsBeforeCursor = text.slice(cursor - 2, cursor);

		// Check if we just completed a wikilink (cursor right after ]])
		if (charsBeforeCursor !== "]]") return;

		// Find matching [[
		const closePos = cursor - 2;
		const openPos = text.lastIndexOf("[[", closePos);

		if (openPos === -1) return;

		// Ensure no nested [[ between open and close
		const between = text.slice(openPos + 2, closePos);

		if (between.includes("[[")) return;

		// Skip if already has an alias
		if (between.includes("|")) return;

		const linkContent = between.trim();
		if (!linkContent) return;

		// Encode to payload
		const payload = WikilinkCodec.encode({
			closePos,
			linkContent,
			view: vu.view,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - nothing to do
			return;
		}

		// Invoke handler and apply result
		void invoke().then((result) => {
			if (result.outcome === HandlerOutcome.Modified && result.data) {
				// Insert alias if set by handler
				WikilinkCodec.insertAlias(result.data);
			}
		});
	}
}
