import { err, ok, type Result } from "neverthrow";
import {
	type App,
	type Editor,
	type EditorPosition,
	MarkdownView,
	TFile,
	TFolder,
} from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import {
	errorInvalidCdArgument,
	errorNoTFileFound,
	errorOpenFileFailed,
} from "../../../errors";
import { getSplitPathForAbstractFile } from "../../../helpers/pathfinder";
import { makeSystemPathForSplitPath } from "../../../impl/common/split-path-and-system-path";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../types/split-path";
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

	private init() {
		const pwdResult = this.reader.pwd();
		if (pwdResult.isOk()) {
			this.lastOpenedFiles.push(pwdResult.value);
		}
	}

	pwd(): Result<SplitPathToMdFile, string> {
		return this.reader.pwd();
	}

	getOpenedTFile(): Result<TFile, string> {
		return this.reader.getOpenedTFile();
	}

	getContent(): Result<string, string> {
		return this.reader.getContent();
	}

	replaceAllContentInOpenedFile(content: string): Result<string, string> {
		return this.reader.getEditor().map(({ editor }) => {
			this.setContentWithPositionPreservation(editor, content);
			return content;
		});
	}

	isFileActive(splitPath: SplitPathToMdFile): Result<boolean, string> {
		return this.reader.isFileActive(splitPath);
	}

	saveSelection(): Result<SavedSelection | null, string> {
		const editorResult = this.reader.getEditorAnyMode();
		if (editorResult.isErr()) return ok(null); // No active editor

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
		const editorResult = this.reader.getEditor();
		if (editorResult.isErr()) return null;
		const { editor } = editorResult.value;
		return editor.getSelection() || null;
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

	private setContentWithPositionPreservation(
		editor: Editor,
		newContent: string,
	): void {
		const oldContent = editor.getValue();
		if (oldContent === newContent) return;

		// Save cursor and scroll position
		const cursor = editor.getCursor();
		const scrollInfo = editor.getScrollInfo();

		// Full content replacement - ensures proper decoration refresh
		editor.setValue(newContent);

		// Restore cursor (clamped to valid position)
		const newLines = newContent.split("\n");
		const newLine = Math.min(cursor.line, newLines.length - 1);
		const newCh = Math.min(cursor.ch, (newLines[newLine] ?? "").length);
		editor.setCursor({ ch: newCh, line: newLine });

		// Restore scroll position
		editor.scrollTo(scrollInfo.left, scrollInfo.top);
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
				// Save cursor and scroll position
				const cursor = editor.getCursor();
				const scrollInfo = editor.getScrollInfo();

				// Option B: setValue + rebuildView for proper re-render
				editor.setValue(after);
				await new Promise((r) => requestAnimationFrame(r));
				const leaf = this.app.workspace.activeLeaf as unknown as {
					rebuildView?: () => void;
				} | null;
				leaf?.rebuildView?.();

				// Restore cursor (clamped to valid position)
				const newLines = after.split("\n");
				const newLine = Math.min(cursor.line, newLines.length - 1);
				const newCh = Math.min(
					cursor.ch,
					(newLines[newLine] ?? "").length,
				);
				editor.setCursor({ ch: newCh, line: newLine });

				// Restore scroll position
				editor.scrollTo(scrollInfo.left, scrollInfo.top);
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
			// Only reveal file in explorer if sidebar is visible and explorer exists
			// Using `as unknown` because `leftSplit.collapsed` is not in public Obsidian API types
			const leftSplit = this.app.workspace.leftSplit as unknown as {
				collapsed: boolean;
			} | null;
			const sidebarVisible = leftSplit && !leftSplit.collapsed;
			if (sidebarVisible) {
				const fileExplorerLeaves =
					this.app.workspace.getLeavesOfType("file-explorer");
				if (fileExplorerLeaves.length > 0) {
					// Using `as unknown` because `commands` is not in public Obsidian API types
					(
						this.app as unknown as {
							commands: {
								executeCommandById: (id: string) => void;
							};
						}
					).commands.executeCommandById(
						"file-explorer:reveal-active-file",
					);
				}
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

	isInActiveView(splitPath: AnySplitPath): boolean {
		return this.reader.isInActiveView(splitPath);
	}

	readContent(__splitPath: SplitPathToMdFile): string {
		const contentResult = this.getContent();
		if (contentResult.isErr()) {
			throw new Error(contentResult.error);
		}
		return contentResult.value;
	}

	exists(splitPath: AnySplitPath): boolean {
		if (splitPath.kind === "Folder") return false;
		if (this.isInActiveView(splitPath)) return true;
		const systemPath = makeSystemPathForSplitPath(splitPath);
		return this.app.vault.getAbstractFileByPath(systemPath) !== null;
	}

	list(folder: SplitPathToFolder): AnySplitPath[] {
		const folderPath = makeSystemPathForSplitPath(folder);
		const tFolder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(tFolder instanceof TFolder)) return [];
		return tFolder.children.map(getSplitPathForAbstractFile);
	}

	getAbstractFile<SP extends AnySplitPath>(
		splitPath: SP,
	): SP["kind"] extends "Folder" ? TFolder : TFile {
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
