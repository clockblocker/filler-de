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
 * Ignores undo and redo, so a rewrite stays undoable.
 *
 * Skips (`completedLinkAt`):
 * - Links that already have an alias (contain |)
 * - Nested wikilinks
 * - Links spanning lines
 * - Empty link content
 *
 * The payload carries where Obsidian resolves the link from its source note
 * (`getFirstLinkpathDest`) and whether it is an embed, so the handler can
 * tell a link to a Library or other note from a word to land on its
 * Crossroad note.
 */

import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { Plugin } from "obsidian";
import { PayloadKind } from "../../types/payload-base";
import type { HandlerInvoker } from "../../user-event-interceptor";
import { getCurrentFilePath } from "../get-current-file-path";
import { WikilinkCodec } from "./codec";
import { type CompletedLink, completedLinkAt } from "./link-at";
import type { InternalWikilinkPayload } from "./payload";

export class WikilinkDetector {
	private extension: ReturnType<typeof EditorView.updateListener.of> | null =
		null;
	private listening = false;
	private readonly invoker: HandlerInvoker<InternalWikilinkPayload>;

	constructor(
		private readonly plugin: Plugin,
		createInvoker: (
			kind: PayloadKind,
		) => HandlerInvoker<InternalWikilinkPayload>,
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
		// Undoing a rewrite brings the completed link back; answering it again
		// would make the rewrite impossible to undo.
		if (
			vu.transactions.some(
				(tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo"),
			)
		)
			return;

		const link =
			this.detectCursorAfterClose(vu) ?? this.detectWrappedSelection(vu);

		if (!link) return;

		const payload = WikilinkCodec.encode({ link, view: vu.view });
		const currentFile = getCurrentFilePath(this.plugin.app);
		payload.sourcePath = currentFile
			? [...currentFile.pathParts, `${currentFile.basename}.md`].join("/")
			: undefined;
		payload.resolvedPath = this.resolve(
			link.linkContent,
			payload.sourcePath,
		);

		const { applies, invoke } = this.invoker(payload);

		if (!applies) return;

		void invoke().then((result) => {
			if (result.outcome !== "effect") return;
			if ("resolvedTarget" in result.effect) {
				WikilinkCodec.replaceTarget(payload, result.effect);
				return;
			}
			WikilinkCodec.insertAlias(payload, result.effect);
		});
	}

	/** Where Obsidian resolves the link from its source note, if anywhere. */
	private resolve(
		linkContent: string,
		sourcePath?: string,
	): string | undefined {
		if (!sourcePath) return undefined;
		return this.plugin.app.metadataCache.getFirstLinkpathDest(
			linkContent,
			sourcePath,
		)?.path;
	}

	/** Case 1: cursor positioned right after ]] (manual typing) */
	private detectCursorAfterClose(vu: ViewUpdate): CompletedLink | null {
		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();

		if (text.slice(cursor - 2, cursor) !== "]]") return null;

		return completedLinkAt(text, cursor - 2);
	}

	/** Case 2: selection wrapped in [[...]] (Obsidian bracket-wraps selected text) */
	private detectWrappedSelection(vu: ViewUpdate): CompletedLink | null {
		const sel = vu.state.selection.main;
		if (sel.from === sel.to) return null; // no selection

		const text = vu.state.doc.toString();

		if (text.slice(sel.from - 2, sel.from) !== "[[") return null;
		if (text.slice(sel.to, sel.to + 2) !== "]]") return null;

		return completedLinkAt(text, sel.to);
	}
}
