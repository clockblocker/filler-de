import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { logError, logWarning } from "../../helpers/issue-handlers";
import type { BackgroundFileService } from "./background-file-service";
import {
	type BackgroundVaultAction,
	BackgroundVaultActionType,
	getActionTargetPath,
} from "./background-vault-actions";

/**
 * Executes vault actions via BackgroundFileService.
 *
 * Actions should already be sorted by weight before calling execute().
 *
 * NOTE: Chain logic (parent folder creation, empty folder cleanup)
 * is handled by DiffToActionsMapper, NOT here.
 * @see src/commanders/librarian/diffing/diff-to-actions.ts
 */
export class VaultActionExecutor {
	constructor(private fileService: BackgroundFileService) {}

	/**
	 * Execute a list of actions in order.
	 * Continues on error (logs and moves to next action).
	 */
	async execute(actions: readonly BackgroundVaultAction[]): Promise<void> {
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

	private async executeOne(action: BackgroundVaultAction): Promise<void> {
		const { type, payload } = action;

		switch (type) {
			case BackgroundVaultActionType.CreateFolder:
				await this.fileService.createFolder(payload.prettyPath);
				break;

			case BackgroundVaultActionType.RenameFolder:
				await this.fileService.renameFolder(payload.from, payload.to);
				break;

			case BackgroundVaultActionType.TrashFolder:
				await this.fileService.trashFolder(payload.prettyPath);
				break;

			case BackgroundVaultActionType.CreateFile:
				// Use createOrUpdate to handle both new files and updates (e.g., codex files)
				await this.fileService.createOrUpdate(
					payload.prettyPath,
					payload.content,
				);
				break;

			case BackgroundVaultActionType.RenameFile:
				await this.fileService.move({
					from: { ...payload.from },
					to: { ...payload.to },
				});
				break;

			case BackgroundVaultActionType.TrashFile:
				await this.fileService.trash(payload.prettyPath);
				break;

			case BackgroundVaultActionType.ProcessFile:
				await this.processFile(payload.prettyPath, payload.transform);
				break;

			case BackgroundVaultActionType.WriteFile:
				await this.fileService.replaceContent(
					payload.prettyPath,
					payload.content,
				);
				break;

			case BackgroundVaultActionType.ReadFile:
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
		const currentContent = await this.fileService.readContent(prettyPath);
		const newContent = await transform(currentContent);
		await this.fileService.replaceContent(prettyPath, newContent);
	}
}
