import { err, ok, type Result } from "neverthrow";
import {
	type App,
	type Editor,
	type EditorPosition,
	MarkdownView,
} from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import type { SplitPathToMdFile } from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import type { OpenedFileReader } from "./reader/opened-file-reader";

export type SavedSelection = {
	anchor: EditorPosition;
	head: EditorPosition;
};

export type SavedInlineTitleSelection = {
	start: number;
	end: number;
	text: string;
};

export class OpenedFileWriter {
	constructor(
		private app: App,
		private reader: OpenedFileReader,
	) {}

	replaceAllContentInOpenedFile(content: string): Result<string, string> {
		return this.reader.getEditor().map(({ editor }) => {
			this.setContentWithPositionPreservation(editor, content);
			return content;
		});
	}

	saveSelection(): Result<SavedSelection | null, string> {
		const editorResult = this.reader.getEditorAnyMode();
		if (editorResult.isErr()) return ok(null);

		const { editor } = editorResult.value;
		const selections = editor.listSelections?.();
		if (!selections?.length) return ok(null);

		const sel = selections[0];
		if (!sel) return ok(null);
		return ok({ anchor: sel.anchor, head: sel.head });
	}

	restoreSelection(saved: SavedSelection): Result<void, string> {
		return this.reader.getEditorAnyMode().map(({ editor }) => {
			editor.setSelection(saved.anchor, saved.head);
		});
	}

	saveInlineTitleSelection(): Result<
		SavedInlineTitleSelection | null,
		string
	> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return ok(null);

		const inlineTitle = view.contentEl.querySelector(
			DomSelectors.INLINE_TITLE,
		) as HTMLElement | null;
		if (!inlineTitle) return ok(null);

		if (document.activeElement !== inlineTitle) return ok(null);

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return ok(null);

		const range = selection.getRangeAt(0);
		if (!inlineTitle.contains(range.commonAncestorContainer))
			return ok(null);

		const text = inlineTitle.textContent ?? "";

		let start = range.startOffset;
		let end = range.endOffset;
		if (
			range.startContainer === inlineTitle ||
			range.endContainer === inlineTitle
		) {
			start = 0;
			end = text.length;
		}

		return ok({ end, start, text });
	}

	restoreInlineTitleSelection(
		saved: SavedInlineTitleSelection,
	): Result<void, string> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return err("No active view");

		const inlineTitle = view.contentEl.querySelector(
			DomSelectors.INLINE_TITLE,
		) as HTMLElement | null;
		if (!inlineTitle) return err("No inline title element");

		inlineTitle.focus();

		const selection = window.getSelection();
		if (!selection) return err("No selection API");

		const textNode = inlineTitle.firstChild;
		if (!textNode) return err("No text node in inline title");

		try {
			const range = document.createRange();
			const textLength = textNode.textContent?.length ?? 0;
			const start = Math.min(saved.start, textLength);
			const end = Math.min(saved.end, textLength);
			range.setStart(textNode, start);
			range.setEnd(textNode, end);
			selection.removeAllRanges();
			selection.addRange(range);
			return ok(undefined);
		} catch (e) {
			return err(e instanceof Error ? e.message : String(e));
		}
	}

	replaceSelection(text: string): void {
		this.reader
			.getEditor()
			.map(({ editor }) => editor.replaceSelection(text));
	}

	insertBelowCursor(text: string): void {
		this.reader.getEditor().map(({ editor }) => {
			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);
			editor.replaceRange(`\n${text}\n`, { ch: 0, line: insertLine });
		});
	}

	async processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): Promise<Result<string, string>> {
		const isActive = this.reader.isFileActive(splitPath);
		if (isActive.isErr()) return err(isActive.error);
		if (!isActive.value) return err("File is not active");

		const editorResult = this.reader.getEditor();
		if (editorResult.isErr()) return err(editorResult.error);

		try {
			const { editor } = editorResult.value;
			const before = editor.getValue();
			const after = await transform(before);

			if (after !== before) {
				const cursor = editor.getCursor();
				const scrollInfo = editor.getScrollInfo();

				editor.setValue(after);
				await new Promise((r) => requestAnimationFrame(r));
				const leaf = this.app.workspace.activeLeaf as unknown as {
					rebuildView?: () => void;
				} | null;
				leaf?.rebuildView?.();

				const newLines = after.split("\n");
				const newLine = Math.min(cursor.line, newLines.length - 1);
				const newCh = Math.min(
					cursor.ch,
					(newLines[newLine] ?? "").length,
				);
				editor.setCursor({ ch: newCh, line: newLine });

				editor.scrollTo(scrollInfo.left, scrollInfo.top);
			}
			return ok(after);
		} catch (error) {
			return err(error instanceof Error ? error.message : String(error));
		}
	}

	private setContentWithPositionPreservation(
		editor: Editor,
		newContent: string,
	): void {
		const oldContent = editor.getValue();
		if (oldContent === newContent) return;

		const cursor = editor.getCursor();
		const scrollInfo = editor.getScrollInfo();

		editor.setValue(newContent);

		const newLines = newContent.split("\n");
		const newLine = Math.min(cursor.line, newLines.length - 1);
		const newCh = Math.min(cursor.ch, (newLines[newLine] ?? "").length);
		editor.setCursor({ ch: newCh, line: newLine });

		editor.scrollTo(scrollInfo.left, scrollInfo.top);
	}
}
