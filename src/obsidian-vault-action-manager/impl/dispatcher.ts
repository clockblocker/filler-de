import { err, ok, type Result } from "neverthrow";
import type {
	SplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";
import { collapseActions } from "./collapse";
import { buildDependencyGraph } from "./dependency-detector";
import {
	ensureDestinationsExist,
	getDestinationsToCheck,
} from "./ensure-requirements-helpers";
import type { SelfEventTracker } from "./event-processing/self-event-tracker";
import type { Executor } from "./executor";
import { makeSplitPath } from "./split-path-and-system-path";
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
	 * INVARIANT: When actions are passed to executor, all requirements are met:
	 * - Files/folders that need to exist have been created
	 * - Delete actions only execute if target exists
	 */
	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		private readonly existenceChecker: ExistenceChecker,
	) {}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		if (actions.length === 0) {
			return ok(undefined);
		}

		// Ensure all requirements are met: check existence, filter invalid deletes, add missing creates
		const withEnsured = await this.ensureAllRequirementsMet(actions);
		const collapsed = await collapseActions(withEnsured);

		// Sort by dependencies using topological sort
		// Note: Dependency graph is built AFTER ensureDestinationsExist, so newly added
		// CreateFolder actions (e.g., for rename destination parents) are included
		// and their parent folder dependencies are correctly set.
		const graph = buildDependencyGraph(collapsed);
		const sorted = topologicalSort(collapsed, graph);

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
	 * - Add EnsureExist actions recursively for all parent paths
	 * - Add CreateFolder/UpsertMdFile actions for required destinations
	 *
	 * INVARIANT: After this, executor can assume all requirements are met.
	 */
	private async ensureAllRequirementsMet(
		actions: readonly VaultAction[],
	): Promise<VaultAction[]> {
		const result: VaultAction[] = [];

		// Filter out invalid delete actions
		for (const action of actions) {
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
			} else {
				result.push(action);
			}
		}

		// Get destinations to check
		const destinations = getDestinationsToCheck(
			actions,
			(path) => this.pathToSplitPathToFolder(path),
			(key) => this.keyToSplitPathToMdFile(key),
		);

		// Ensure destinations exist and get actions to add
		const actionsToAdd = await ensureDestinationsExist(
			destinations,
			this.existenceChecker,
			(path) => this.pathToSplitPathToFolder(path),
			(key) => this.keyToSplitPathToMdFile(key),
			result,
		);

		result.push(...actionsToAdd);

		return result;
	}

	/**
	 * Convert a folder path string to SplitPathToFolder.
	 */
	private pathToSplitPathToFolder(path: string): SplitPathToFolder | null {
		const parsed = makeSplitPath(path);
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
		const parsed = makeSplitPath(key);
		if (parsed.type === "MdFile") {
			return parsed;
		}
		return null;
	}
}
