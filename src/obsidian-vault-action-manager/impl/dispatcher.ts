import { err, ok, type Result } from "neverthrow";
import { pathToFolderFromPathParts } from "../helpers/pathfinder";
import type {
	SplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { sortActionsByWeight, VaultActionType } from "../types/vault-action";
import { collapseActions } from "./collapse";
import { buildDependencyGraph } from "./dependency-detector";
import type { Executor } from "./executor";
import type { SelfEventTrackerLegacy } from "./self-event-tracker";
import { makeSystemPathForSplitPath, splitPath } from "./split-path";
import { topologicalSort } from "./topological-sort";

export type DispatchResult = Result<void, DispatchError[]>;

export type DispatchError = {
	action: VaultAction;
	error: string;
};

/**
 * Service to check if files/folders exist.
 */
export type ExistenceChecker = {
	exists(splitPath: SplitPath): Promise<boolean>;
};

export class Dispatcher {
	/**
	 * Feature flag: use topological sort instead of weight-based sort.
	 * When enabled, actions are sorted by explicit dependencies.
	 * When disabled, uses weight-based sort (backward compatibility).
	 */
	private useTopologicalSort = false;

	/**
	 * INVARIANT: When actions are passed to executor, all requirements are met:
	 * - Files/folders that need to exist have been created
	 * - Delete actions only execute if target exists
	 */
	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTrackerLegacy,
		private readonly existenceChecker: ExistenceChecker,
	) {}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		if (actions.length === 0) {
			return ok(undefined);
		}

		// Ensure all requirements are met: check existence, filter invalid deletes, add missing creates
		const withEnsured = await this.ensureAllRequirementsMet(actions);

		const collapsed = await collapseActions(withEnsured);

		// Re-ensure requirements after collapse (collapse may have removed UpsertMdFile needed for ProcessMdFile)
		const withReEnsured = await this.ensureAllRequirementsMet(collapsed);

		// Sort by dependencies (topological) or by weight (legacy)
		let sorted: VaultAction[];
		if (this.useTopologicalSort) {
			const graph = buildDependencyGraph(withReEnsured);
			sorted = topologicalSort(withReEnsured, graph);
		} else {
			sorted = sortActionsByWeight(withReEnsured);
		}

		// Register paths from SORTED actions (the ones that will actually execute)
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
	 * Ensure all requirements are met before execution:
	 * - Filter out delete actions if target doesn't exist
	 * - Add CreateFolder/UpsertMdFile actions for required destinations
	 *
	 * INVARIANT: After this, executor can assume all requirements are met.
	 */
	private async ensureAllRequirementsMet(
		actions: readonly VaultAction[],
	): Promise<VaultAction[]> {
		const folderKeys = new Set<string>();
		const fileKeys = new Set<string>();
		const result: VaultAction[] = [];

		// Process actions: filter invalid deletes, collect requirements
		for (const action of actions) {
			// Filter out delete actions if target doesn't exist
			if (
				action.type === VaultActionType.TrashFolder ||
				action.type === VaultActionType.TrashFile ||
				action.type === VaultActionType.TrashMdFile
			) {
				const exists = await this.existenceChecker.exists(
					action.payload.splitPath,
				);
				if (!exists) {
					// Target doesn't exist - skip delete action
					continue;
				}
				result.push(action);
				continue;
			}

			// Non-delete actions: collect requirements
			switch (action.type) {
				// Actions with splitPath: extract parent folders
				case VaultActionType.CreateFolder:
				case VaultActionType.CreateFile:
				case VaultActionType.UpsertMdFile:
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
					// For ProcessMdFile and ReplaceContentMdFile, ensure the file exists
					if (
						action.type === VaultActionType.ProcessMdFile ||
						action.type === VaultActionType.ReplaceContentMdFile
					) {
						const fileKey = makeSystemPathForSplitPath(
							splitPath as SplitPathToMdFile,
						);
						fileKeys.add(fileKey);
					}
					result.push(action);
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
					result.push(action);
					break;
				}
			}
		}

		// Add CreateFolder actions for required folders (only if they don't exist)
		for (const folderPath of folderKeys) {
			const folderSplitPath = this.pathToSplitPathToFolder(folderPath);
			if (!folderSplitPath) {
				continue;
			}

			// Check if folder already exists
			const exists = await this.existenceChecker.exists(folderSplitPath);
			if (!exists) {
				result.push({
					payload: { splitPath: folderSplitPath },
					type: VaultActionType.CreateFolder,
				});
			}
		}

		// Add UpsertMdFile actions for required files (only if they don't exist)
		for (const fileKey of fileKeys) {
			const fileSplitPath = this.keyToSplitPathToMdFile(fileKey);
			if (!fileSplitPath) {
				continue;
			}

			// Check if file already exists
			const exists = await this.existenceChecker.exists(fileSplitPath);
			if (exists) {
				continue; // File exists, no need to create
			}

			// Check if UpsertMdFile already exists in the batch
			const alreadyHasCreate = result.some(
				(action) =>
					action.type === VaultActionType.UpsertMdFile &&
					makeSystemPathForSplitPath(action.payload.splitPath) ===
						fileKey,
			);

			if (!alreadyHasCreate) {
				result.push({
					payload: { content: "", splitPath: fileSplitPath },
					type: VaultActionType.UpsertMdFile,
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
