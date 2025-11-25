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
				await this.createFolder(payload.prettyPath);
				break;

			case BackgroundVaultActionType.RenameFolder:
				await this.renameFolder(payload.from, payload.to);
				break;

			case BackgroundVaultActionType.TrashFolder:
				await this.trashFolder(payload.prettyPath);
				break;

			case BackgroundVaultActionType.CreateFile:
				await this.createFile(payload.prettyPath, payload.content);
				break;

			case BackgroundVaultActionType.RenameFile:
				await this.renameFile(payload.from, payload.to);
				break;

			case BackgroundVaultActionType.TrashFile:
				await this.trashFile(payload.prettyPath);
				break;

			case BackgroundVaultActionType.ProcessFile:
				await this.processFile(payload.prettyPath, payload.transform);
				break;

			case BackgroundVaultActionType.WriteFile:
				await this.writeFile(payload.prettyPath, payload.content);
				break;

			case BackgroundVaultActionType.ReadFile:
				// ReadFile is a no-op in executor (result not captured)
				// This action type exists for completeness but typically
				// you'd read files directly, not through the queue
				logWarning({
					description: `ReadFile action in queue is a no-op: ${getActionTargetPath(action)}`,
					location: "VaultActionExecutor.executeOne",
				});
				break;

			default: {
				// Exhaustive check
				const _exhaustive: never = type;
				throw new Error(`Unknown action type: ${_exhaustive}`);
			}
		}
	}

	private async createFolder(prettyPath: PrettyPath): Promise<void> {
		// BackgroundFileService.create handles folder creation internally
		// For explicit folder creation, we'd need to extend the service
		// For now, folders are created implicitly when files are created
		logWarning({
			description: `CreateFolder not yet implemented: ${prettyPath.pathParts.join("/")}/${prettyPath.basename}`,
			location: "VaultActionExecutor.createFolder",
		});
	}

	private async renameFolder(
		from: PrettyPath,
		to: PrettyPath,
	): Promise<void> {
		// Would need to extend BackgroundFileService for folder rename
		logWarning({
			description: "RenameFolder not yet implemented",
			location: "VaultActionExecutor.renameFolder",
		});
	}

	private async trashFolder(prettyPath: PrettyPath): Promise<void> {
		// Would need to extend BackgroundFileService for folder trash
		logWarning({
			description: "TrashFolder not yet implemented",
			location: "VaultActionExecutor.trashFolder",
		});
	}

	private async createFile(
		prettyPath: PrettyPath,
		content?: string,
	): Promise<void> {
		await this.fileService.create({
			...prettyPath,
			content,
		});
	}

	private async renameFile(from: PrettyPath, to: PrettyPath): Promise<void> {
		await this.fileService.move({
			from: { ...from },
			to: { ...to },
		});
	}

	private async trashFile(prettyPath: PrettyPath): Promise<void> {
		await this.fileService.trash(prettyPath);
	}

	private async processFile(
		prettyPath: PrettyPath,
		transform: (content: string) => string | Promise<string>,
	): Promise<void> {
		const currentContent = await this.fileService.readContent(prettyPath);
		const newContent = await transform(currentContent);
		await this.fileService.replaceContent(prettyPath, newContent);
	}

	private async writeFile(
		prettyPath: PrettyPath,
		content: string,
	): Promise<void> {
		await this.fileService.replaceContent(prettyPath, content);
	}
}
