import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import {
	type App,
	type Editor,
	type EditorChange,
	type EditorPosition,
	MarkdownView,
} from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import { errorNoActiveView } from "../../../errors";
import type { SplitPathToMdFile } from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import type {
	ActiveFileReader,
	EditorWithView,
} from "./reader/active-file-reader";

export type SavedSelection = {
	anchor: EditorPosition;
	head: EditorPosition;
};

export type SavedInlineTitleSelection = {
	start: number;
	end: number;
	text: string;
};

export class ActiveFileWriter {
	constructor(
		private app: App,
		private reader: ActiveFileReader,
	) {}

	replaceAllContentInActiveFile(
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

		if (after === before) return after;

		const oldLines = before.split("\n");
		const newLines = after.split("\n");

		const changes: EditorChange[] = [];
		const maxLines = Math.max(oldLines.length, newLines.length);

		for (let i = 0; i < maxLines; i++) {
			const oldLine = oldLines[i] ?? "";
			const newLine = newLines[i];

			if (newLine === undefined) {
				// Lines deleted — replace from start of this line to end of doc
				changes.push({
					from: { ch: 0, line: i },
					text: "",
					to: {
						ch: oldLines[oldLines.length - 1]?.length ?? 0,
						line: oldLines.length - 1,
					},
				});
				break;
			}

			// Only replace existing lines in the loop; new lines are added by "Handle added lines at end"
			// (otherwise we double-apply when after has more lines than before, e.g. adding go-back link to empty file)
			if (i < oldLines.length && oldLine !== newLine) {
				changes.push({
					from: { ch: 0, line: i },
					text: newLine,
					to: { ch: oldLine.length, line: i },
				});
			}
		}

		// Handle added lines at end
		if (newLines.length > oldLines.length) {
			const lastOldLine = oldLines.length - 1;
			changes.push({
				from: {
					ch: oldLines[lastOldLine]?.length ?? 0,
					line: lastOldLine,
				},
				text: `\n${newLines.slice(oldLines.length).join("\n")}`,
			});
		}

		if (changes.length) {
			editor.transaction({ changes });
		}

		return after;
	}
}
