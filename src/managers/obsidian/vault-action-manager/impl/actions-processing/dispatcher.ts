import { err, ok, type Result } from "neverthrow";
import { logger } from "../../../../../utils/logger";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../common/split-path-and-system-path";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import { collapseActions } from "./collapse";
import { buildDependencyGraph } from "./dependency-detector";
import {
	ensureDestinationsExist,
	getDestinationsToCheck,
} from "./ensure-requirements-helpers";
import type { Executor } from "./executor";
import { topologicalSort } from "./topological-sort";

export type DispatchResult = Result<void, DispatchError[]>;

export type DispatchError = {
	action: VaultAction;
	error: string;
};

/**
 * Single trace entry recording one action's execution result.
 */
export type DebugTraceEntry = {
	batch: number;
	index: number;
	kind: string;
	path: string;
	result: "ok" | "err";
	error?: string;
};

/**
 * Debug state accumulated across dispatch batches.
 * Use `resetDebugState()` to clear between test runs.
 */
export type DispatcherDebugState = {
	/** Number of dispatch batches executed since last reset */
	batchCounter: number;
	/** Execution trace entries accumulated across all batches */
	executionTrace: DebugTraceEntry[];
	/** Sorted actions from each batch (array of arrays) */
	allSortedActions: VaultAction[][];
	/** Errors from the most recent batch only */
	lastErrors: DispatchError[];
};

/**
 * Service to check if files/folders exist.
 */
export type ExistenceChecker = {
	exists(splitPath: AnySplitPath): boolean;
};

export class Dispatcher {
	/**
	 * INVARIANT: When actions are passed to executor, all requirements are met:
	 * - Files/folders that need to exist have been created
	 * - Delete actions only execute if target exists
	 */

	// Debug state - accumulates across batches, call resetDebugState() to clear
	private _debugLastSortedActions: VaultAction[] = [];
	private _debugAllSortedActions: VaultAction[][] = [];
	private _debugLastErrors: DispatchError[] = [];
	private _debugBatchCounter = 0;
	private _debugExecutionTrace: DebugTraceEntry[] = [];

	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		private readonly existenceChecker: ExistenceChecker,
	) {}

	/**
	 * Reset all debug state. Call at the start of each test to get clean traces.
	 */
	resetDebugState(): void {
		this._debugBatchCounter = 0;
		this._debugExecutionTrace = [];
		this._debugAllSortedActions = [];
		this._debugLastSortedActions = [];
		this._debugLastErrors = [];
	}

	/**
	 * Get accumulated debug state across all dispatch batches since last reset.
	 */
	getDebugState(): DispatcherDebugState {
		return {
			allSortedActions: this._debugAllSortedActions,
			batchCounter: this._debugBatchCounter,
			executionTrace: this._debugExecutionTrace,
			lastErrors: this._debugLastErrors,
		};
	}

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

		const errors: DispatchError[] = [];

		// Store sorted actions for debugging - ACCUMULATE across batches
		this._debugBatchCounter++;
		const currentBatch = this._debugBatchCounter;
		this._debugLastSortedActions = sorted;
		this._debugAllSortedActions.push(sorted);
		this._debugLastErrors = [];
		// Don't clear trace - accumulate across batches

		// Register ALL actions upfront before any execution.
		// This ensures that paths from later actions (e.g., ProcessScrollBacklink)
		// don't re-register paths that were already popped by earlier actions
		// (e.g., RenameMdFile). Without this, user renames between healing rename
		// and backlink processing would be incorrectly filtered.
		this.selfEventTracker.register(sorted);

		for (const [i, action] of sorted.entries()) {
			// Get path info for logging
			const actionPath =
				action.kind === VaultActionKind.RenameFile ||
				action.kind === VaultActionKind.RenameMdFile ||
				action.kind === VaultActionKind.RenameFolder
					? `${makeSystemPathForSplitPath((action.payload as { from: AnySplitPath }).from)} → ${makeSystemPathForSplitPath((action.payload as { to: AnySplitPath }).to)}`
					: makeSystemPathForSplitPath(
							(action.payload as { splitPath: AnySplitPath })
								.splitPath,
						);

			try {
				const result = await this.executor.execute(action);
				if (result.isErr()) {
					logger.error("[Dispatcher] Action failed", {
						actionPath,
						error: result.error,
						index: i,
						kind: action.kind,
					});
					const errorInfo = {
						action,
						error: result.error,
					};
					errors.push(errorInfo);
					this._debugLastErrors.push(errorInfo);
					// Add to execution trace
					this._debugExecutionTrace.push({
						batch: currentBatch,
						error: result.error,
						index: i,
						kind: action.kind,
						path: actionPath,
						result: "err",
					});
				} else {
					// Add to execution trace
					this._debugExecutionTrace.push({
						batch: currentBatch,
						index: i,
						kind: action.kind,
						path: actionPath,
						result: "ok",
					});
				}
			} catch (e) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				logger.error("[Dispatcher] Action threw exception", {
					actionPath,
					error: errorMsg,
					index: i,
					kind: action.kind,
				});
				const errorInfo = {
					action,
					error: `EXCEPTION: ${errorMsg}`,
				};
				errors.push(errorInfo);
				this._debugLastErrors.push(errorInfo);
				// Add to execution trace
				this._debugExecutionTrace.push({
					batch: currentBatch,
					error: `EXCEPTION: ${errorMsg}`,
					index: i,
					kind: action.kind,
					path: actionPath,
					result: "err",
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
				action.kind === VaultActionKind.TrashFolder ||
				action.kind === VaultActionKind.TrashFile ||
				action.kind === VaultActionKind.TrashMdFile
			) {
				if (!this.existenceChecker.exists(action.payload.splitPath)) {
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
			result,
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
		if (parsed.kind === "Folder") {
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
		if (parsed.kind === "MdFile") {
			return parsed;
		}
		return null;
	}
}
