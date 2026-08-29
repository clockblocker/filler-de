import { type Result, ResultAsync } from "neverthrow";
import type { TFile, Vault } from "obsidian";
import { getErrorMessage } from "../internal/get-error-message";
import {
	classifyReadContentError,
	type ReadContentError,
} from "../types/read-content-error";
import type {
	AnySplitPath,
	SplitPathFromTo,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../types/split-path";
import type { Transform } from "../types/vault-action";
import type { ActiveFileService } from "./active-view/active-file-service";
import {
	type SelectionInfo,
	SelectionService,
} from "./active-view/selection-service";
import type { TFileHelper } from "./background/helpers/tfile-helper";

/**
 * Owns the active-editor/background-vault routing policy for Markdown files.
 * Callers express an operation; this module chooses and coordinates the adapter.
 */
export class MarkdownFileAccess {
	private readonly selection: SelectionService;

	constructor(
		private readonly activeEditor: ActiveFileService,
		private readonly backgroundVault: TFileHelper,
		private readonly vault: Vault,
	) {
		this.selection = new SelectionService(activeEditor);
	}

	async readContent(
		target: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>> {
		if (this.isActive(target)) {
			return this.activeEditor
				.getContent()
				.mapErr((reason) => classifyReadContentError(reason));
		}

		const immediate = this.backgroundVault.getFile(target);
		const fileResult = immediate.isOk()
			? immediate
			: await this.backgroundVault.getFileWithRetry(target);

		return fileResult
			.mapErr((reason) => classifyReadContentError(reason))
			.asyncAndThen((file) =>
				ResultAsync.fromPromise(this.vault.read(file), (error) =>
					classifyReadContentError(getErrorMessage(error)),
				),
			);
	}

	async replaceContent(
		target: SplitPathToMdFile,
		content: string,
	): Promise<Result<unknown, string>> {
		if (this.isActive(target)) {
			return this.activeEditor.replaceAllContentInActiveFile(content);
		}
		return this.backgroundVault.replaceAllContent(target, content);
	}

	async processContent(args: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): Promise<Result<unknown, string>> {
		if (this.isActive(args.splitPath)) {
			return this.activeEditor.processContent(args);
		}
		return this.backgroundVault.processContent(args);
	}

	async renameFile<SPF extends SplitPathToAnyFile>(
		paths: SplitPathFromTo<SPF>,
	): Promise<Result<TFile, string>> {
		const savedSelection = this.activeEditor
			.saveInlineTitleSelection()
			.unwrapOr(null);
		const result = await this.backgroundVault.renameFile(paths);

		if (result.isOk() && savedSelection) {
			await new Promise<void>((resolve) => setTimeout(resolve, 50));
			this.activeEditor.restoreInlineTitleSelection(savedSelection);
		}

		return result;
	}

	isActive(target: AnySplitPath): boolean {
		return this.activeEditor.isInActiveView(target);
	}

	activeMdPath(): SplitPathToMdFile | null {
		return this.activeEditor.mdPwd();
	}

	openedContent(): Result<string, string> {
		return this.activeEditor.getContent();
	}

	selectionInfo(): SelectionInfo | null {
		return this.selection.getInfo();
	}

	selectionText(): string | null {
		return this.activeEditor.getSelection();
	}

	async open(target: SplitPathToMdFile): Promise<Result<void, string>> {
		return (await this.activeEditor.cd(target)).map(() => undefined);
	}

	scrollOpenedFileToLine(line: number): void {
		this.activeEditor.scrollToLine(line);
	}
}
