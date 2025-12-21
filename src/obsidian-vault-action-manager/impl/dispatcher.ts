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

		console.log("[Dispatcher] dispatch: input actions:", actions.length);
		console.log(
			"[Dispatcher] dispatch: input action types:",
			actions.map((a) => a.type),
		);

		// Ensure all destinations exist: add CreateFolder/CreateMdFile actions
		const withEnsured = this.ensureAllDestinationsExist(actions);
		console.log(
			"[Dispatcher] dispatch: after ensureAllDestinationsExist:",
			withEnsured.length,
		);
		console.log(
			"[Dispatcher] dispatch: after ensureAllDestinationsExist types:",
			withEnsured.map((a) => a.type),
		);

		const collapsed = await collapseActions(withEnsured);
		console.log(
			"[Dispatcher] dispatch: after collapseActions:",
			collapsed.length,
		);
		console.log(
			"[Dispatcher] dispatch: after collapseActions types:",
			collapsed.map((a) => a.type),
		);
		console.log(
			"[Dispatcher] dispatch: after collapseActions details:",
			collapsed.map((a) => {
				if ("splitPath" in a.payload) {
					return {
						path: makeSystemPathForSplitPath(a.payload.splitPath),
						type: a.type,
					};
				}
				if ("from" in a.payload && "to" in a.payload) {
					return {
						from: makeSystemPathForSplitPath(a.payload.from),
						to: makeSystemPathForSplitPath(a.payload.to),
						type: a.type,
					};
				}
				return { path: "N/A", type: a.type };
			}),
		);

		const sorted = sortActionsByWeight(collapsed);
		console.log(
			"[Dispatcher] dispatch: after sortActionsByWeight:",
			sorted.length,
		);

		// Register paths from COLLAPSED actions (the ones that will actually execute)
		// This ensures we track paths from the final actions, not the original batch
		this.selfEventTracker.register(sorted);

		const errors: DispatchError[] = [];

		console.log(
			"[Dispatcher] dispatch: executing",
			sorted.length,
			"actions",
		);
		for (const action of sorted) {
			let systemPath = "N/A";
			if ("splitPath" in action.payload) {
				systemPath = makeSystemPathForSplitPath(
					action.payload.splitPath,
				);
			} else if ("from" in action.payload && "to" in action.payload) {
				systemPath = `${makeSystemPathForSplitPath(action.payload.from)} -> ${makeSystemPathForSplitPath(action.payload.to)}`;
			}
			console.log(
				"[Dispatcher] dispatch: executing action:",
				action.type,
				systemPath,
			);
			const result = await this.executor.execute(action);
			if (result.isErr()) {
				console.error(
					"[Dispatcher] dispatch: action failed:",
					action.type,
					systemPath,
					result.error,
				);
				errors.push({
					action,
					error: result.error,
				});
			} else {
				console.log(
					"[Dispatcher] dispatch: action succeeded:",
					action.type,
					systemPath,
				);
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
