import type { EditorView } from "@codemirror/view";
import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import {
	type App,
	type Editor,
	type EditorPosition,
	MarkdownView,
} from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import { errorNoActiveView } from "../../../errors";
import type { SplitPathToMdFile } from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import type {
	EditorWithView,
	OpenedFileReader,
} from "./reader/opened-file-reader";

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

	replaceAllContentInOpenedFile(
		content: string,
	): ResultAsync<string, string> {
		return this.reader
			.pwd()
			.andThen((path) =>
				path.kind === "MdFile"
					? ok(path)
					: err("Active file is not a markdown file"),
			)
			.asyncAndThen((splitPath) =>
				this.processContent({ splitPath, transform: () => content }),
			);
	}

	saveSelection(): Result<SavedSelection | null, string> {
		return this.reader
			.getEditorAnyMode()
			.andThen(({ editor }) => this.extractFirstSelection(editor))
			.orElse(() => ok(null));
	}

	restoreSelection(saved: SavedSelection): Result<void, string> {
		return this.reader.getEditorAnyMode().map(({ editor }) => {
			return editor.setSelection(saved.anchor, saved.head);
		});
	}

	saveInlineTitleSelection(): Result<
		SavedInlineTitleSelection | null,
		string
	> {
		return this.getMarkdownView()
			.andThen((view) => this.getInlineTitleElement(view))
			.andThen((el) => this.validateInlineTitleFocused(el))
			.andThen((el) => this.getSelectionInElement(el))
			.andThen(({ el, range }) =>
				this.buildInlineTitleSelection(el, range),
			)
			.orElse(() => ok(null));
	}

	restoreInlineTitleSelection(
		saved: SavedInlineTitleSelection,
	): Result<void, string> {
		return this.getMarkdownView()
			.andThen((view) => this.getInlineTitleElement(view))
			.andThen((el) => this.focusAndGetTextNode(el))
			.andThen(({ textNode }) =>
				this.applySelectionRange(textNode, saved),
			);
	}

	replaceSelection(text: string): Result<void, string> {
		return this.reader
			.getEditor()
			.map(({ editor }) => editor.replaceSelection(text));
	}

	insertBelowCursor(text: string): Result<void, string> {
		return this.reader.getEditor().map(({ editor }) => {
			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);
			return editor.replaceRange(`\n${text}\n`, {
				ch: 0,
				line: insertLine,
			});
		});
	}

	processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): ResultAsync<string, string> {
		const validated = this.validateFileIsActive(splitPath);
		if (validated.isErr()) {
			return errAsync(validated.error);
		}
		return this.applyTransformToEditor(validated.value.editor, transform);
	}

	// --- Validators for saveSelection ---

	private extractFirstSelection(
		editor: Editor,
	): Result<SavedSelection, string> {
		const selections = editor.listSelections?.();
		if (!selections?.length) return err("No selections");
		const sel = selections[0];
		if (!sel) return err("No first selection");
		return ok({ anchor: sel.anchor, head: sel.head });
	}

	// --- Validators for inline title selection ---

	private getMarkdownView(): Result<MarkdownView, string> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view ? ok(view) : err(errorNoActiveView());
	}

	private getInlineTitleElement(
		view: MarkdownView,
	): Result<HTMLElement, string> {
		const el = view.contentEl.querySelector(
			DomSelectors.INLINE_TITLE,
		) as HTMLElement | null;
		return el ? ok(el) : err("No inline title element");
	}

	private validateInlineTitleFocused(
		el: HTMLElement,
	): Result<HTMLElement, string> {
		return document.activeElement === el
			? ok(el)
			: err("Inline title not focused");
	}

	private getSelectionInElement(
		el: HTMLElement,
	): Result<{ el: HTMLElement; range: Range }, string> {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0)
			return err("No selection");

		const range = selection.getRangeAt(0);
		if (!el.contains(range.commonAncestorContainer))
			return err("Selection not in element");

		return ok({ el, range });
	}

	private buildInlineTitleSelection(
		el: HTMLElement,
		range: Range,
	): Result<SavedInlineTitleSelection, string> {
		const text = el.textContent ?? "";
		let start = range.startOffset;
		let end = range.endOffset;

		if (range.startContainer === el || range.endContainer === el) {
			start = 0;
			end = text.length;
		}

		return ok({ end, start, text });
	}

	// --- Validators for restoreInlineTitleSelection ---

	private focusAndGetTextNode(
		el: HTMLElement,
	): Result<{ textNode: ChildNode }, string> {
		el.focus();
		const selection = window.getSelection();
		if (!selection) return err("No selection API");
		const textNode = el.firstChild;
		if (!textNode) return err("No text node in inline title");
		return ok({ textNode });
	}

	private applySelectionRange(
		textNode: ChildNode,
		saved: SavedInlineTitleSelection,
	): Result<void, string> {
		try {
			const selection = window.getSelection();
			if (!selection) return err("No selection API");

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

	// --- Validators for processContent ---

	private validateFileIsActive(
		splitPath: SplitPathToMdFile,
	): Result<EditorWithView, string> {
		return this.reader
			.isFileActive(splitPath)
			.andThen((isActive) =>
				isActive ? ok(undefined) : err("File is not active"),
			)
			.andThen(() => this.reader.getEditor());
	}

	private applyTransformToEditor(
		editor: Editor,
		transform: Transform,
	): ResultAsync<string, string> {
		return ResultAsync.fromPromise(
			this.doApplyTransform(editor, transform),
			(e) => (e instanceof Error ? e.message : String(e)),
		);
	}

	private async doApplyTransform(
		editor: Editor,
		transform: Transform,
	): Promise<string> {
		const before = editor.getValue();
		const after = await transform(before);

		if (after !== before) {
			const cursor = editor.getCursor();
			const scrollInfo = editor.getScrollInfo();

			// Using `as unknown` because `cm` is not in public Obsidian API types
			const cm = (editor as unknown as { cm?: EditorView }).cm;
			if (cm) {
				// Surgical edit: only change the affected lines
				const changes = this.computeLineChanges(before, after);
				if (changes) {
					cm.dispatch({ changes });
				}
				await this.waitForEditorStable(cm);
			} else {
				editor.setValue(after);
				await new Promise((r) => requestAnimationFrame(r));
			}

			this.restoreCursorPosition(editor, cursor, scrollInfo, after);
		}
		return after;
	}

	/**
	 * Compute minimal CM6 changes between old and new content.
	 * Finds first/last differing lines and returns a single change for that range.
	 */
	private computeLineChanges(
		before: string,
		after: string,
	): { from: number; to: number; insert: string } | null {
		const oldLines = before.split("\n");
		const newLines = after.split("\n");

		// Find first differing line
		let firstDiff = 0;
		while (
			firstDiff < oldLines.length &&
			firstDiff < newLines.length &&
			oldLines[firstDiff] === newLines[firstDiff]
		) {
			firstDiff++;
		}

		// If no diff found, nothing to change
		if (firstDiff === oldLines.length && firstDiff === newLines.length) {
			return null;
		}

		// Find last differing line (from end)
		let oldEndOffset = oldLines.length - 1;
		let newEndOffset = newLines.length - 1;
		while (
			oldEndOffset > firstDiff &&
			newEndOffset > firstDiff &&
			oldLines[oldEndOffset] === newLines[newEndOffset]
		) {
			oldEndOffset--;
			newEndOffset--;
		}

		// Compute character offsets
		let fromChar = 0;
		for (let i = 0; i < firstDiff; i++) {
			fromChar += (oldLines[i]?.length ?? 0) + 1; // +1 for newline
		}

		let toChar = fromChar;
		for (let i = firstDiff; i <= oldEndOffset; i++) {
			toChar +=
				(oldLines[i]?.length ?? 0) + (i < oldLines.length - 1 ? 1 : 0);
		}

		// Build insert string from new lines
		const insertLines = newLines.slice(firstDiff, newEndOffset + 1);
		const insert = insertLines.join("\n");

		return { from: fromChar, insert, to: toChar };
	}

	private waitForEditorStable(
		cm: EditorView,
		timeoutMs = 200,
	): Promise<void> {
		const container = cm.contentDOM;

		return new Promise((resolve) => {
			let debounceTimer: ReturnType<typeof setTimeout>;

			const observer = new MutationObserver(() => {
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					observer.disconnect();
					resolve();
				}, 16); // 1 frame of no mutations = stable
			});

			observer.observe(container, {
				characterData: true,
				childList: true,
				subtree: true,
			});

			// Fallback timeout
			debounceTimer = setTimeout(() => {
				observer.disconnect();
				resolve();
			}, timeoutMs);
		});
	}

	private restoreCursorPosition(
		editor: Editor,
		cursor: EditorPosition,
		scrollInfo: { left: number; top: number },
		newContent: string,
	): void {
		const newLines = newContent.split("\n");
		const newLine = Math.min(cursor.line, newLines.length - 1);
		const newCh = Math.min(cursor.ch, (newLines[newLine] ?? "").length);
		editor.setCursor({ ch: newCh, line: newLine });
		editor.scrollTo(scrollInfo.left, scrollInfo.top);
	}
}
