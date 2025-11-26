import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { logError, logWarning } from "../../helpers/issue-handlers";
import type { OpenedFileService } from "../active-view/opened-file-service";
import type { BackgroundFileService } from "./background-file-service";
import {
	getActionTargetPath,
	type VaultAction,
	VaultActionType,
} from "./background-vault-actions";

/**
 * Executes vault actions via BackgroundFileService or OpenedFileService.
 * Routes to OpenedFileService if the target file is currently active.
 *
 * Actions should already be sorted by weight before calling execute().
 *
 * NOTE: Chain logic (parent folder creation, empty folder cleanup)
 * is handled by DiffToActionsMapper, NOT here.
 * @see src/commanders/librarian/diffing/diff-to-actions.ts
 */
export class VaultActionExecutor {
	constructor(
		private fileService: BackgroundFileService,
		private openedFileService: OpenedFileService | null = null,
	) {}

	/**
	 * Execute a list of actions in order.
	 * Continues on error (logs and moves to next action).
	 */
	async execute(actions: readonly VaultAction[]): Promise<void> {
		for (const action of actions) {
			try {
				await this.executeOne(action);
			} catch (error) {
				logError({
					description: `Failed to execute ${action.type} on ${getActionTargetPath(action)}: ${error instanceof Error ? error.message : String(error)}`,
					location: "VaultActionExecutor.execute",
				});
			}
		}
	}

	private async executeOne(action: VaultAction): Promise<void> {
		const { type, payload } = action;

		switch (type) {
			case VaultActionType.UpdateOrCreateFolder:
				await this.fileService.createFolder(payload.prettyPath);
				break;

			case VaultActionType.RenameFolder:
				await this.fileService.renameFolder(payload.from, payload.to);
				break;

			case VaultActionType.TrashFolder:
				await this.fileService.trashFolder(payload.prettyPath);
				break;

			case VaultActionType.UpdateOrCreateFile:
				// Check if file exists and is active - if so, use editor
				if (this.isFileActive(payload.prettyPath)) {
					await this.writeToActiveFile(payload.content ?? "");
				} else {
					// Use createOrUpdate to handle both new files and updates (e.g., codex files)
					await this.fileService.createOrUpdate(
						payload.prettyPath,
						payload.content,
					);
				}
				break;

			case VaultActionType.RenameFile:
				await this.fileService.move({
					from: { ...payload.from },
					to: { ...payload.to },
				});
				break;

			case VaultActionType.TrashFile:
				await this.fileService.trash(payload.prettyPath);
				break;

			case VaultActionType.ProcessFile:
				await this.processFile(payload.prettyPath, payload.transform);
				break;

			case VaultActionType.WriteFile:
				if (this.isFileActive(payload.prettyPath)) {
					await this.writeToActiveFile(payload.content);
				} else {
					await this.fileService.replaceContent(
						payload.prettyPath,
						payload.content,
					);
				}
				break;

			case VaultActionType.ReadFile:
				// ReadFile is a no-op in executor (result not captured)
				logWarning({
					description: `ReadFile action in queue is a no-op: ${getActionTargetPath(action)}`,
					location: "VaultActionExecutor.executeOne",
				});
				break;

			default: {
				const _exhaustive: never = type;
				throw new Error(`Unknown action type: ${_exhaustive}`);
			}
		}
	}

	private async processFile(
		prettyPath: PrettyPath,
		transform: (content: string) => string | Promise<string>,
	): Promise<void> {
		if (this.isFileActive(prettyPath)) {
			const currentContent = await this.readFromActiveFile();
			const newContent = await transform(currentContent);
			await this.writeToActiveFile(newContent);
		} else {
			const currentContent =
				await this.fileService.readContent(prettyPath);
			const newContent = await transform(currentContent);
			await this.fileService.replaceContent(prettyPath, newContent);
		}
	}

	private isFileActive(prettyPath: PrettyPath): boolean {
		if (!this.openedFileService) {
			return false;
		}
		const filePath = this.prettyPathToFilePath(prettyPath);
		const isActive = this.openedFileService.isFileActive(filePath);

		// Double-check: verify the active file path matches exactly
		if (isActive) {
			const activeFile = this.openedFileService
				.getApp()
				.workspace.getActiveFile();
			if (activeFile?.path !== filePath) {
				// Path mismatch - file might have changed
				return false;
			}
		}

		return isActive;
	}

	private prettyPathToFilePath(prettyPath: PrettyPath): string {
		// PrettyPath basename doesn't include extension, but Obsidian file paths do
		const path = [
			...prettyPath.pathParts,
			`${prettyPath.basename}.md`,
		].join("/");
		// Normalize path (remove leading slash if present, handle empty pathParts)
		return path.startsWith("/") ? path.slice(1) : path;
	}

	private async readFromActiveFile(): Promise<string> {
		if (!this.openedFileService) {
			throw new Error("OpenedFileService not available");
		}
		const maybeContent = await this.openedFileService.getMaybeFileContent();
		if (maybeContent.error) {
			throw new Error(
				`Failed to read from active file: ${maybeContent.description ?? "Unknown error"}`,
			);
		}
		return maybeContent.data;
	}

	private async writeToActiveFile(content: string): Promise<void> {
		if (!this.openedFileService) {
			throw new Error("OpenedFileService not available");
		}
		const maybeResult =
			await this.openedFileService.replaceAllContentInOpenedFile(content);
		if (maybeResult.error) {
			throw new Error(
				`Failed to write to active file: ${maybeResult.description ?? "Unknown error"}`,
			);
		}
	}
}
