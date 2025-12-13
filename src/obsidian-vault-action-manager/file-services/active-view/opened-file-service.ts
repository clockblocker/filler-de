import { err, ok, type Result } from "neverthrow";
import { type App, MarkdownView, TFile } from "obsidian";
import { splitPathKey } from "../../impl/split-path";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../types/split-path";
import {
	errorGetEditor,
	errorInvalidCdArgument,
	errorNoTFileFound,
	errorOpenFileFailed,
} from "./common";
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
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.file) {
				return err(errorGetEditor());
			}

			const editor = view.editor;
			// biome-ignore lint/suspicious/noExplicitAny: CodeMirror API not fully typed
			const cm = (editor as any).cm as {
				scrollDOM: { scrollTop: number };
				lineAtHeight: (height: number) => number;
			};

			// 1) Get top visible line index and content
			const scrollTop = cm.scrollDOM.scrollTop;
			const topLineIndex = Math.floor(cm.lineAtHeight(scrollTop));
			const topLineContent = editor.getLine(topLineIndex) ?? "";

			// 2) Apply write
			editor.setValue(content);

			// 3) Find the saved line content in new content
			const newLines = content.split("\n");
			let targetLineIndex = topLineIndex;

			// Search for the line content, starting from original index
			const foundIndex = newLines.findIndex(
				(line, idx) => idx >= topLineIndex && line === topLineContent,
			);
			if (foundIndex !== -1) {
				targetLineIndex = foundIndex;
			} else {
				// If not found from original index, search backwards
				const foundIndexBackward = newLines
					.slice(0, topLineIndex)
					.map((line, idx) => ({ idx, line }))
					.reverse()
					.find(({ line }) => line === topLineContent)?.idx;
				if (foundIndexBackward !== undefined) {
					targetLineIndex = foundIndexBackward;
				} else {
					const foundIndexAnywhere = newLines.indexOf(topLineContent);
					if (foundIndexAnywhere !== -1) {
						targetLineIndex = foundIndexAnywhere;
					}
					// If not found at all, use original index (clamped to valid range)
					else {
						targetLineIndex = Math.min(
							topLineIndex,
							newLines.length - 1,
						);
					}
				}
			}

			// 4) Scroll to found line or original index
			editor.scrollIntoView(
				{
					from: { ch: 0, line: targetLineIndex },
					to: { ch: 0, line: targetLineIndex },
				},
				true,
			);

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
