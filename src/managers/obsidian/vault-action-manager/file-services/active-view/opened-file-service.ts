import { err, ok, type Result } from "neverthrow";
import {
	type App,
	type Editor,
	type EditorPosition,
	MarkdownView,
	TFile,
	TFolder,
} from "obsidian";
import { DomSelectors } from "../../../../../utils/dom-selectors";
import {
	errorFileStale,
	errorGetEditor,
	errorInvalidCdArgument,
	errorNoTFileFound,
	errorNotInSourceMode,
	errorOpenFileFailed,
} from "../../errors";
import { getSplitPathForAbstractFile } from "../../helpers/pathfinder";
import { makeSystemPathForSplitPath } from "../../impl/common/split-path-and-system-path";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import type { OpenedFileReader } from "./opened-file-reader";

export type SavedSelection = {
	anchor: EditorPosition;
	head: EditorPosition;
};

export type SavedInlineTitleSelection = {
	start: number;
	end: number;
	text: string;
};

export class OpenedFileService {
	private lastOpenedFiles: SplitPathToMdFile[] = [];
	private reader: OpenedFileReader;

	constructor(
		private app: App,
		reader: OpenedFileReader,
	) {
		this.reader = reader;
		this.init();
	}

	private async init() {
		const pwdResult = await this.reader.pwd();
		if (pwdResult.isOk()) {
			this.lastOpenedFiles.push(pwdResult.value);
		}
	}

	async pwd(): Promise<Result<SplitPathToMdFile, string>> {
		return await this.reader.pwd();
	}

	async getOpenedTFile(): Promise<Result<TFile, string>> {
		return await this.reader.getOpenedTFile();
	}

	async getContent(): Promise<Result<string, string>> {
		return await this.reader.getContent();
	}

	async replaceAllContentInOpenedFile(
		content: string,
	): Promise<Result<string, string>> {
		try {
			const editorResult = this.getEditor();
			if (editorResult.isErr()) {
				return err(editorResult.error);
			}

			const { editor } = editorResult.value;
			this.setContentWithPositionPreservation(editor, content);

			return ok(content);
		} catch (error) {
			return err(
				errorGetEditor(
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}

	async isFileActive(
		splitPath: SplitPathToMdFile,
	): Promise<Result<boolean, string>> {
		const pwdResult = await this.pwd();
		if (pwdResult.isErr()) {
			return err(pwdResult.error);
		}

		const pwd = pwdResult.value;
		// Check both pathParts and basename to ensure it's the same file
		const isActive =
			pwd.pathParts.length === splitPath.pathParts.length &&
			pwd.pathParts.every(
				(part, index) => part === splitPath.pathParts[index],
			) &&
			pwd.basename === splitPath.basename;

		return ok(isActive);
	}

	saveSelection(): Result<SavedSelection | null, string> {
		const editorResult = this.getEditorAnyMode();
		if (editorResult.isErr()) return ok(null); // No active editor

		const { editor } = editorResult.value;
		const selections = editor.listSelections?.();
		if (!selections?.length) return ok(null);

		const sel = selections[0];
		if (!sel) return ok(null);
		return ok({ anchor: sel.anchor, head: sel.head });
	}

	restoreSelection(saved: SavedSelection): Result<void, string> {
		const editorResult = this.getEditorAnyMode();
		if (editorResult.isErr()) return err(editorResult.error);

		const { editor } = editorResult.value;
		editor.setSelection(saved.anchor, saved.head);
		return ok(undefined);
	}

	saveInlineTitleSelection(): Result<
		SavedInlineTitleSelection | null,
		string
	> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return ok(null);

		// Find the inline title element
		const inlineTitle = view.contentEl.querySelector(
			DomSelectors.INLINE_TITLE,
		) as HTMLElement | null;
		if (!inlineTitle) return ok(null);

		// Check if inline title has focus
		if (document.activeElement !== inlineTitle) return ok(null);

		// Get selection using DOM Selection API
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return ok(null);

		const range = selection.getRangeAt(0);
		// Verify selection is within inline title
		if (!inlineTitle.contains(range.commonAncestorContainer))
			return ok(null);

		const text = inlineTitle.textContent ?? "";

		// Handle case where entire element is selected (node indices vs char offsets)
		// When selecting all, browser may use element as container with offsets 0-1
		let start = range.startOffset;
		let end = range.endOffset;
		if (
			range.startContainer === inlineTitle ||
			range.endContainer === inlineTitle
		) {
			// Selection is on element level, convert to character offsets
			start = 0;
			end = text.length;
		}

		return ok({
			end,
			start,
			text,
		});
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

		// Focus the inline title
		inlineTitle.focus();

		// Restore selection
		const selection = window.getSelection();
		if (!selection) return err("No selection API");

		const textNode = inlineTitle.firstChild;
		if (!textNode) return err("No text node in inline title");

		try {
			const range = document.createRange();
			const textLength = textNode.textContent?.length ?? 0;
			// Clamp offsets to current text length
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

	getSelection(): string | null {
		const editorResult = this.getEditor();
		if (editorResult.isErr()) return null;
		const { editor } = editorResult.value;
		const selection = editor.getSelection();
		return selection || null;
	}

	replaceSelection(text: string): void {
		const editorResult = this.getEditor();
		if (editorResult.isErr()) return;
		const { editor } = editorResult.value;
		editor.replaceSelection(text);
	}

	insertBelowCursor(text: string): void {
		const editorResult = this.getEditor();
		if (editorResult.isErr()) return;
		const { editor } = editorResult.value;

		const sel = editor.listSelections?.()[0];
		const cursor = sel?.head ?? editor.getCursor();
		const insertLine = Math.max(cursor.line + 1, 0);

		editor.replaceRange(`\n${text}\n`, { ch: 0, line: insertLine });
	}

	private getEditorAnyMode(): Result<
		{ editor: Editor; view: MarkdownView },
		string
	> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) {
			return err(errorGetEditor());
		}
		return ok({ editor: view.editor, view });
	}

	private getEditor(): Result<
		{ editor: Editor; view: MarkdownView },
		string
	> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) {
			return err(errorGetEditor());
		}

		// Verify file still exists in vault (may be deleted/renamed while open)
		// Note: On rename, Obsidian may update view.file to a new TFile object,
		// so we check path existence rather than object identity
		const fileInVault = this.app.vault.getAbstractFileByPath(
			view.file.path,
		);
		if (!fileInVault) {
			return err(errorGetEditor(errorFileStale(view.file.path)));
		}

		if (view.getMode() !== "source") {
			return err(errorGetEditor(errorNotInSourceMode()));
		}

		return ok({ editor: view.editor, view });
	}

	private setContentWithPositionPreservation(
		editor: Editor,
		newContent: string,
	): void {
		const oldContent = editor.getValue();
		if (oldContent === newContent) return;

		const cursor = editor.getCursor();
		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");

		// Find first differing line
		let startLine = 0;
		while (
			startLine < oldLines.length &&
			startLine < newLines.length &&
			oldLines[startLine] === newLines[startLine]
		) {
			startLine++;
		}

		// Find last differing line (from end)
		let oldEndLine = oldLines.length - 1;
		let newEndLine = newLines.length - 1;
		while (
			oldEndLine > startLine &&
			newEndLine > startLine &&
			oldLines[oldEndLine] === newLines[newEndLine]
		) {
			oldEndLine--;
			newEndLine--;
		}

		// Edge case: no actual diff found (shouldn't happen given early return above)
		if (startLine > oldEndLine && startLine > newEndLine) {
			return;
		}

		// Build replacement text from differing lines
		const replacementLines = newLines.slice(startLine, newEndLine + 1);
		const replacement = replacementLines.join("\n");

		// Calculate positions for replaceRange
		const fromPos = { ch: 0, line: startLine };
		const toPos = {
			ch: oldLines[oldEndLine]?.length ?? 0,
			line: oldEndLine,
		};

		// Apply surgical edit - avoids full document replacement flicker
		editor.replaceRange(replacement, fromPos, toPos);

		// Adjust cursor if it was in or after the changed region
		const lineDelta = newLines.length - oldLines.length;
		if (cursor.line >= startLine) {
			const newCursorLine = Math.max(
				0,
				Math.min(cursor.line + lineDelta, newLines.length - 1),
			);
			const newLineText = newLines[newCursorLine] ?? "";
			const newCursorCh = Math.min(cursor.ch, newLineText.length);
			editor.setCursor({ ch: newCursorCh, line: newCursorLine });
		}
	}

	async processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): Promise<Result<string, string>> {
		const fileIsActive = await this.isFileActive(splitPath);
		if (fileIsActive.isErr()) {
			return err(fileIsActive.error);
		}

		if (!fileIsActive.value) {
			return err("File is not active");
		}

		const editorResult = this.getEditor();
		if (editorResult.isErr()) {
			return err(editorResult.error);
		}

		const { editor } = editorResult.value;

		try {
			const before = editor.getValue();
			const after = await transform(before);

			if (after !== before) {
				this.setContentWithPositionPreservation(editor, after);
			}

			return ok(after);
		} catch (error) {
			return err(error instanceof Error ? error.message : String(error));
		}
	}

	public async cd(file: TFile): Promise<Result<TFile, string>>;
	public async cd(
		file: SplitPathToFile | SplitPathToMdFile,
	): Promise<Result<TFile, string>>;
	public async cd(
		file: TFile | SplitPathToFile | SplitPathToMdFile,
	): Promise<Result<TFile, string>> {
		let tfile: TFile;
		if (
			typeof (file as TFile).path === "string" &&
			(file as TFile).extension !== undefined
		) {
			tfile = file as TFile;
		} else if (
			typeof (file as SplitPathToFile | SplitPathToMdFile).basename ===
				"string" &&
			Array.isArray(
				(file as SplitPathToFile | SplitPathToMdFile).pathParts,
			)
		) {
			const splitPath = file as SplitPathToFile | SplitPathToMdFile;
			const systemPath = makeSystemPathForSplitPath(splitPath);

			const tfileMaybeLegacy =
				this.app.vault.getAbstractFileByPath(systemPath);
			if (!tfileMaybeLegacy || !(tfileMaybeLegacy instanceof TFile)) {
				return err(errorNoTFileFound(systemPath));
			}
			tfile = tfileMaybeLegacy;
		} else {
			return err(errorInvalidCdArgument());
		}

		try {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(tfile);
			// Ensure leaf is properly marked active so getActiveViewOfType() returns it immediately
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
			// Only reveal file in explorer if explorer is already open
			const fileExplorerLeaves =
				this.app.workspace.getLeavesOfType("file-explorer");
			if (fileExplorerLeaves.length > 0) {
				// Using `as unknown` because `commands` is not in public Obsidian API types
				(
					this.app as unknown as {
						commands: { executeCommandById: (id: string) => void };
					}
				).commands.executeCommandById(
					"file-explorer:reveal-active-file",
				);
			}
			// Wait for view DOM to be ready before returning
			await this.waitForViewReady(tfile);
			return ok(tfile);
		} catch (error) {
			return err(
				errorOpenFileFailed(
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}

	// Methods for Reader compatibility
	/**
	 * Wait for the view to be ready (DOM rendered) using MutationObserver.
	 * Returns when `.cm-contentContainer` appears in the view's contentEl.
	 */
	private waitForViewReady(tfile: TFile, timeoutMs = 500): Promise<void> {
		return new Promise((resolve) => {
			const checkView = () => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const hasContainer = view?.contentEl.querySelector(
					DomSelectors.CM_CONTENT_CONTAINER,
				);
				const pathMatch = view?.file?.path === tfile.path;
				if (pathMatch && hasContainer) {
					return true;
				}
				return false;
			};

			if (checkView()) {
				resolve();
				return;
			}

			const observer = new MutationObserver(() => {
				if (checkView()) {
					observer.disconnect();
					resolve();
				}
			});

			observer.observe(document.body, { childList: true, subtree: true });

			setTimeout(() => {
				observer.disconnect();
				resolve();
			}, timeoutMs);
		});
	}

	async isInActiveView(splitPath: AnySplitPath): Promise<boolean> {
		if (splitPath.kind !== "MdFile") return false;
		const result = await this.isFileActive(splitPath);
		return result.isOk() && result.value;
	}

	async readContent(__splitPath: SplitPathToMdFile): Promise<string> {
		const contentResult = await this.getContent();
		if (contentResult.isErr()) {
			throw new Error(contentResult.error);
		}
		return contentResult.value;
	}

	async exists(splitPath: AnySplitPath): Promise<boolean> {
		if (splitPath.kind === "Folder") return false;
		const isActive = await this.isInActiveView(splitPath);
		if (isActive) return true;
		const systemPath = makeSystemPathForSplitPath(splitPath);
		return this.app.vault.getAbstractFileByPath(systemPath) !== null;
	}

	async list(folder: SplitPathToFolder): Promise<AnySplitPath[]> {
		const folderPath = makeSystemPathForSplitPath(folder);
		const tFolder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(tFolder instanceof TFolder)) return [];

		return tFolder.children.map(getSplitPathForAbstractFile);
	}

	async getAbstractFile<SP extends AnySplitPath>(
		splitPath: SP,
	): Promise<SP["kind"] extends "Folder" ? TFolder : TFile> {
		const systemPath = makeSystemPathForSplitPath(splitPath);
		const file = this.app.vault.getAbstractFileByPath(systemPath);
		if (!file) {
			throw new Error(`File not found: ${systemPath}`);
		}
		if (splitPath.kind === "Folder" && !(file instanceof TFolder)) {
			throw new Error(`Expected folder but got file: ${systemPath}`);
		}
		if (splitPath.kind !== "Folder" && !(file instanceof TFile)) {
			throw new Error(`Expected file but got folder: ${systemPath}`);
		}
		return file as SP["kind"] extends "Folder" ? TFolder : TFile;
	}
}
