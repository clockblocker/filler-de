import { err, ok, type Result } from "neverthrow";
import { type App, MarkdownView, TFile, type TFolder } from "obsidian";
import { DomSelectors } from "../../../../../utils/dom-selectors";
import {
	errorInvalidCdArgument,
	errorNoTFileFound,
	errorOpenFileFailed,
} from "../../errors";
import { makeSystemPathForSplitPath } from "../../impl/common/split-path-and-system-path";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import {
	OpenedFileWriter,
	type SavedInlineTitleSelection,
	type SavedSelection,
} from "./writer/opened-file-writer";
import { OpenedFileReader } from "./writer/reader/opened-file-reader";

export type { SavedInlineTitleSelection, SavedSelection };

export class OpenedFileService {
	private lastOpenedFiles: SplitPathToMdFile[] = [];
	private readonly reader: OpenedFileReader;
	private readonly writer: OpenedFileWriter;

	constructor(private app: App) {
		this.reader = new OpenedFileReader(app);
		this.writer = new OpenedFileWriter(app, this.reader);
		this.init();
	}

	private init() {
		const pwdResult = this.reader.pwd();
		if (pwdResult.isOk()) {
			this.lastOpenedFiles.push(pwdResult.value);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Reader delegations
	// ─────────────────────────────────────────────────────────────────────────

	pwd(): Result<SplitPathToMdFile, string> {
		return this.reader.pwd();
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

	readContent(splitPath: SplitPathToMdFile): string {
		return this.reader.readContent(splitPath);
	}

	exists(splitPath: AnySplitPath): boolean {
		return this.reader.exists(splitPath);
	}

	list(folder: SplitPathToFolder): AnySplitPath[] {
		return this.reader.list(folder);
	}

	getAbstractFile<SP extends AnySplitPath>(
		splitPath: SP,
	): SP["kind"] extends "Folder" ? TFolder : TFile {
		return this.reader.getAbstractFile(splitPath);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Writer delegations
	// ─────────────────────────────────────────────────────────────────────────

	replaceAllContentInOpenedFile(content: string): Result<string, string> {
		return this.writer.replaceAllContentInOpenedFile(content);
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
	}): Promise<Result<string, string>> {
		return this.writer.processContent(args);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Navigation (will move to Navigator later)
	// ─────────────────────────────────────────────────────────────────────────

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
			this.app.workspace.setActiveLeaf(leaf, { focus: true });
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

	private waitForViewReady(tfile: TFile, timeoutMs = 500): Promise<void> {
		return new Promise((resolve) => {
			const checkView = () => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const hasContainer = view?.contentEl.querySelector(
					DomSelectors.CM_CONTENT_CONTAINER,
				);
				const pathMatch = view?.file?.path === tfile.path;
				return pathMatch && hasContainer;
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
}
