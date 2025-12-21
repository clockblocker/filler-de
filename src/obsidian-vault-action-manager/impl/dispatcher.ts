import { err, ok, type Result } from "neverthrow";
import { pathToFolderFromPathParts } from "../helpers/pathfinder";
import type { SplitPathToFolder, SplitPathToMdFile } from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { sortActionsByWeight, VaultActionType } from "../types/vault-action";
import { collapseActions } from "./collapse";
import type { Executor } from "./executor";
import type { SelfEventTrackerLegacy } from "./self-event-tracker";
import { makeSystemPathForSplitPath, splitPath } from "./split-path";

export type DispatchResult = Result<void, DispatchError[]>;

export type DispatchError = {
	action: VaultAction;
	error: string;
};

export class Dispatcher {
	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTrackerLegacy,
	) {}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		if (actions.length === 0) {
			return ok(undefined);
		}

		// Ensure all destinations exist: add CreateFolder/CreateMdFile actions
		const withEnsured = this.ensureAllDestinationsExist(actions);

		const collapsed = await collapseActions(withEnsured);
		const sorted = sortActionsByWeight(collapsed);

		// Register paths from COLLAPSED actions (the ones that will actually execute)
		// This ensures we track paths from the final actions, not the original batch
		this.selfEventTracker.register(sorted);

		const errors: DispatchError[] = [];

		for (const action of sorted) {
			const result = await this.executor.execute(action);
			if (result.isErr()) {
				errors.push({
					action,
					error: result.error,
				});
			}
		}

		if (errors.length > 0) {
			return err(errors);
		}

		return ok(undefined);
	}

	/**
	 * Extract all destination folders and files from actions,
	 * and add CreateFolder/CreateMdFile actions to ensure they exist.
	 */
	private ensureAllDestinationsExist(
		actions: readonly VaultAction[],
	): VaultAction[] {
		const folderKeys = new Set<string>();
		const fileKeys = new Set<string>();
		const result: VaultAction[] = [...actions];

		// Extract destination folders and files
		for (const action of actions) {
			switch (action.type) {
				// Non-delete actions with splitPath: extract parent folders
				case VaultActionType.CreateFolder:
				case VaultActionType.CreateFile:
				case VaultActionType.CreateMdFile:
				case VaultActionType.ProcessMdFile:
				case VaultActionType.ReplaceContentMdFile: {
					const { splitPath } = action.payload;
					// Extract all parent folders from pathParts
					for (let i = 1; i <= splitPath.pathParts.length; i++) {
						const parentPathParts = splitPath.pathParts.slice(0, i);
						const parentPath =
							pathToFolderFromPathParts(parentPathParts);
						if (parentPath) {
							folderKeys.add(parentPath);
						}
					}
					// For ProcessMdFile and ReplaceContentMdFile, also ensure the file exists
					if (
						action.type === VaultActionType.ProcessMdFile ||
						action.type === VaultActionType.ReplaceContentMdFile
					) {
						// splitPath is guaranteed to be SplitPathToMdFile for these actions
						const fileKey = makeSystemPathForSplitPath(
							splitPath as SplitPathToMdFile,
						);
						fileKeys.add(fileKey);
					}
					break;
				}

				// Rename actions: extract parent folders from "to" path
				case VaultActionType.RenameFolder:
				case VaultActionType.RenameFile:
				case VaultActionType.RenameMdFile: {
					const { to } = action.payload;
					// Extract all parent folders from "to" pathParts
					for (let i = 1; i <= to.pathParts.length; i++) {
						const parentPathParts = to.pathParts.slice(0, i);
						const parentPath =
							pathToFolderFromPathParts(parentPathParts);
						if (parentPath) {
							folderKeys.add(parentPath);
						}
					}
					break;
				}

				// Trash actions: no destinations to ensure
				case VaultActionType.TrashFolder:
				case VaultActionType.TrashFile:
				case VaultActionType.TrashMdFile:
					break;
			}
		}

		// Create CreateFolder actions for distinct folders
		for (const folderPath of folderKeys) {
			const folderSplitPath = this.pathToSplitPathToFolder(folderPath);
			if (folderSplitPath) {
				result.push({
					payload: { splitPath: folderSplitPath },
					type: VaultActionType.CreateFolder,
				});
			}
		}

		// Create CreateMdFile actions for distinct files
		for (const fileKey of fileKeys) {
			const fileSplitPath = this.keyToSplitPathToMdFile(fileKey);
			if (fileSplitPath) {
				result.push({
					payload: { content: "", splitPath: fileSplitPath },
					type: VaultActionType.CreateMdFile,
				});
			}
		}

		return result;
	}

	/**
	 * Convert a folder path string to SplitPathToFolder.
	 */
	private pathToSplitPathToFolder(path: string): SplitPathToFolder | null {
		const parsed = splitPath(path);
		if (parsed.type === "Folder") {
			return parsed;
		}
		return null;
	}

	/**
	 * Convert a file key string back to SplitPathToMdFile.
	 * Key format: "path/to/file.md" (we stored it with extension)
	 */
	private keyToSplitPathToMdFile(key: string): SplitPathToMdFile | null {
		const parsed = splitPath(key);
		if (parsed.type === "MdFile") {
			return parsed;
		}
		return null;
	}
}
