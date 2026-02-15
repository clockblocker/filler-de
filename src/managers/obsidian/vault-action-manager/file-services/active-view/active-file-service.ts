import type { Result, ResultAsync } from "neverthrow";
import type { App, TFile } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import { cd } from "./navigation/cd";
import {
	ActiveFileWriter,
	type SavedInlineTitleSelection,
	type SavedSelection,
} from "./writer/active-file-writer";
import { ActiveFileReader } from "./writer/reader/active-file-reader";

export type { SavedInlineTitleSelection, SavedSelection };

export class ActiveFileService {
	private readonly reader: ActiveFileReader;
	private readonly writer: ActiveFileWriter;

	constructor(private app: App) {
		this.reader = new ActiveFileReader(app);
		this.writer = new ActiveFileWriter(app, this.reader);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Reader delegations
	// ─────────────────────────────────────────────────────────────────────────

	pwd(): Result<SplitPathToAnyFile, string> {
		return this.reader.pwd();
	}

	mdPwd(): SplitPathToMdFile | null {
		const result = this.reader.pwd();
		if (result.isErr()) return null;
		const path = result.value;
		return path.kind === "MdFile" ? path : null;
	}

	getOpenedTFile(): Result<TFile, string> {
		return this.reader.getOpenedTFile();
	}

	getContent(): Result<string, string> {
		return this.reader.getContent();
	}

	isFileActive(splitPath: SplitPathToMdFile): Result<boolean, string> {
		return this.reader.isFileActive(splitPath);
	}

	isInActiveView(splitPath: AnySplitPath): boolean {
		return this.reader.isInActiveView(splitPath);
	}

	getSelection(): string | null {
		return this.reader.getSelection();
	}

	getCursorOffset(): number | null {
		return this.reader.getCursorOffset();
	}

	getSelectionStartOffset(): number | null {
		return this.reader.getSelectionStartOffset();
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Writer delegations
	// ─────────────────────────────────────────────────────────────────────────

	replaceAllContentInActiveFile(
		content: string,
	): ResultAsync<string, string> {
		return this.writer.replaceAllContentInActiveFile(content);
	}

	saveSelection(): Result<SavedSelection | null, string> {
		return this.writer.saveSelection();
	}

	restoreSelection(saved: SavedSelection): Result<void, string> {
		return this.writer.restoreSelection(saved);
	}

	saveInlineTitleSelection(): Result<
		SavedInlineTitleSelection | null,
		string
	> {
		return this.writer.saveInlineTitleSelection();
	}

	restoreInlineTitleSelection(
		saved: SavedInlineTitleSelection,
	): Result<void, string> {
		return this.writer.restoreInlineTitleSelection(saved);
	}

	replaceSelection(text: string): void {
		this.writer.replaceSelection(text);
	}

	insertBelowCursor(text: string): void {
		this.writer.insertBelowCursor(text);
	}

	processContent(args: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): ResultAsync<string, string> {
		return this.writer.processContent(args);
	}

	/** Scroll the editor to bring the given line into view. No-op if editor is unavailable. */
	scrollToLine(line: number): void {
		const result = this.reader.getEditorAnyMode();
		if (result.isErr()) return;
		const pos = { ch: 0, line };
		result.value.editor.scrollIntoView({ from: pos, to: pos }, true);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Navigation
	// ─────────────────────────────────────────────────────────────────────────

	public async cd(file: TFile): Promise<Result<TFile, string>>;
	public async cd(file: SplitPathToAnyFile): Promise<Result<TFile, string>>;
	public async cd(
		file: TFile | SplitPathToAnyFile,
	): Promise<Result<TFile, string>> {
		return cd(this.app, file);
	}
}
