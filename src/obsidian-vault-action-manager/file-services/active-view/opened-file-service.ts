import { err, ok, type Result } from "neverthrow";
import { type App, type Editor, MarkdownView, TFile } from "obsidian";
import {
	errorFileStale,
	errorGetEditor,
	errorInvalidCdArgument,
	errorNoTFileFound,
	errorNotInSourceMode,
	errorOpenFileFailed,
} from "../../errors";
import { splitPathKey } from "../../impl/split-path";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import type { OpenedFileReader } from "./opened-file-reader";

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
		// Save cursor position
		const cursor = editor.getCursor();
		// Get the line content at cursor (as proxy for visible area)
		const cursorLineContent = editor.getLine(cursor.line) ?? "";

		editor.setValue(newContent);

		const newLines = newContent.split("\n");
		const lineCount = newLines.length;
		let targetLineIndex = cursor.line;

		// Search for the cursor line content in new content, starting from original index
		const foundIndex = newLines.findIndex(
			(line, idx) => idx >= cursor.line && line === cursorLineContent,
		);
		if (foundIndex !== -1) {
			targetLineIndex = foundIndex;
		} else {
			// If not found from original index, search backwards
			const foundIndexBackward = newLines
				.slice(0, cursor.line)
				.map((line, idx) => ({ idx, line }))
				.reverse()
				.find(({ line }) => line === cursorLineContent)?.idx;
			if (foundIndexBackward !== undefined) {
				targetLineIndex = foundIndexBackward;
			} else {
				const foundIndexAnywhere = newLines.indexOf(cursorLineContent);
				if (foundIndexAnywhere !== -1) {
					targetLineIndex = foundIndexAnywhere;
				} else {
					// If not found at all, use original index (clamped to valid range)
					targetLineIndex = Math.min(cursor.line, lineCount - 1);
				}
			}
		}

		// Restore cursor: preserve column if line exists, clamp to line length
		if (cursor.line < lineCount) {
			// Line exists, clamp column to valid range
			const lineLength = editor.getLine(cursor.line).length;
			const clampedCh = Math.min(cursor.ch, lineLength);
			editor.setCursor({ ch: clampedCh, line: cursor.line });
		} else {
			// Cursor line doesn't exist, use target line from line content preservation
			editor.setCursor({ ch: 0, line: targetLineIndex });
		}

		// Scroll to target line
		editor.scrollIntoView(
			{
				from: { ch: 0, line: targetLineIndex },
				to: { ch: 0, line: targetLineIndex },
			},
			true,
		);
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
			const systemPath = splitPathKey(splitPath);

			const tfileMaybe = this.app.vault.getAbstractFileByPath(systemPath);
			if (!tfileMaybe || !(tfileMaybe instanceof TFile)) {
				return err(errorNoTFileFound(systemPath));
			}
			tfile = tfileMaybe;
		} else {
			return err(errorInvalidCdArgument());
		}

		try {
			await this.app.workspace.getLeaf(true).openFile(tfile);
			return ok(tfile);
		} catch (error) {
			return err(
				errorOpenFileFailed(
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}
}
