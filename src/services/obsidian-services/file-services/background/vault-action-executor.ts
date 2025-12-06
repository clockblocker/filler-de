import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { logError } from "../../helpers/issue-handlers";
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
 * Actions should already be sorted by weight before calling execute().
 */
export class VaultActionExecutor {
	constructor(
		private fileService: BackgroundFileService,
		private openedFileService: OpenedFileService,
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

		// biome-ignore lint/suspicious/noExplicitAny: action payload is dynamic
		const prettyPath = (payload as Record<string, any>)?.prettyPath ?? null;

		const isActive = prettyPath
			? await this.openedFileService.isFileActive(prettyPath)
			: false;

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

			case VaultActionType.WriteFile: {
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
		const isActive = await this.openedFileService.isFileActive(prettyPath);

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
