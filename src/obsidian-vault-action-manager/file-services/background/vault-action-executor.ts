import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import type { LegacyOpenedFileService } from "../active-view/opened-file-service";
import type { LegacyBackgroundFileService } from "./background-file-service";
import {
	getActionTargetPath,
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "./background-vault-actions";

/**
 * Executes vault actions via BackgroundFileService or LegacyOpenedFileService.
 * Routes to LegacyOpenedFileService if the target file is currently active.
 * Actions should already be sorted by weight before calling execute().
 */
export class VaultActionExecutor {
	constructor(
		private fileService: LegacyBackgroundFileService,
		private openedFileService: LegacyOpenedFileService,
	) {}

	private async isActiveSafe(prettyPath: PrettyPath): Promise<boolean> {
		try {
			return await this.openedFileService.isFileActive(prettyPath);
		} catch (error) {
			logWarning({
				description: `isFileActive failed for ${[...prettyPath.pathParts, prettyPath.basename].join("/")}: ${error instanceof Error ? error.message : String(error)}`,
				location: "VaultActionExecutor.isActiveSafe",
			});
			return false;
		}
	}

	/**
	 * Execute a list of actions in order.
	 * Continues on error (logs and moves to next action).
	 */
	async execute(actions: readonly LegacyVaultAction[]): Promise<void> {
		for (const action of actions) {
			try {
				await this.executeOne(action);
			} catch (error) {
				logWarning({
					description: `Failed to execute ${action.type} on ${getActionTargetPath(action)}: ${error instanceof Error ? error.message : String(error)}`,
					location: "VaultActionExecutor.execute",
				});
			}
		}
	}

	private async executeOne(action: LegacyVaultAction): Promise<void> {
		const { type, payload } = action;

		switch (type) {
			case LegacyVaultActionType.UpdateOrCreateFolder:
				try {
					await this.fileService.createFolder(payload.prettyPath);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					const alreadyExists =
						message.includes("already exists") ||
						message.includes("EEXIST");
					if (!alreadyExists) {
						throw error;
					}
					logWarning({
						description: `Folder already exists, skipping: ${getActionTargetPath(action)}`,
						location: "VaultActionExecutor.executeOne",
					});
				}
				break;

			case LegacyVaultActionType.RenameFolder:
				await this.fileService.renameFolder(payload.from, payload.to);
				break;

			case LegacyVaultActionType.TrashFolder:
				await this.fileService.trashFolder(payload.prettyPath);
				break;

			case LegacyVaultActionType.UpdateOrCreateFile:
				{
					const isActive = await this.isActiveSafe(
						payload.prettyPath,
					);
					if (isActive) {
						await this.openedFileService.replaceAllContentInOpenedFile(
							payload.content ?? "",
						);
					} else {
						await this.fileService.createOrUpdate(
							payload.prettyPath,
							payload.content,
						);
					}
				}
				break;

			case LegacyVaultActionType.RenameFile:
				try {
					await this.fileService.move({
						from: { ...payload.from },
						to: { ...payload.to },
					});
				} catch (error) {
					logWarning({
						description: `Rename skipped for ${getActionTargetPath(action)}: ${error instanceof Error ? error.message : String(error)}`,
						location: "VaultActionExecutor.executeOne",
					});
				}
				break;

			case LegacyVaultActionType.TrashFile:
				await this.fileService.trash(payload.prettyPath);
				break;

			case LegacyVaultActionType.ProcessFile:
				await this.processFile(payload.prettyPath, payload.transform);
				break;

			case LegacyVaultActionType.WriteFile: {
				const isActive = await this.isActiveSafe(payload.prettyPath);
				if (isActive) {
					await this.openedFileService.replaceAllContentInOpenedFile(
						payload.content,
					);
				} else {
					await this.fileService.replaceContent(
						payload.prettyPath,
						payload.content,
					);
				}
				break;
			}

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
		const isActive = await this.isActiveSafe(prettyPath);

		if (isActive) {
			const currentContent = await this.openedFileService.getContent();
			const newContent = await transform(currentContent);
			await this.openedFileService.replaceAllContentInOpenedFile(
				newContent,
			);
		} else {
			const currentContent =
				await this.fileService.readContent(prettyPath);
			const newContent = await transform(currentContent);
			await this.fileService.replaceContent(prettyPath, newContent);
		}
	}
}
