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
		const dispatchTimestamp = Date.now();
		const scrollRelatedActions = actions.filter(
			(a) =>
				a.kind === VaultActionKind.ProcessMdFile &&
				"splitPath" in a.payload &&
				a.payload.splitPath.basename.includes("Untitled"),
		);
		const renameActions = actions.filter(
			(a) =>
				(a.kind === VaultActionKind.RenameMdFile ||
					a.kind === VaultActionKind.RenameFile ||
					a.kind === VaultActionKind.RenameFolder) &&
				"from" in a.payload &&
				"to" in a.payload,
		);

		logger.info("[Dispatcher] dispatch() CALLED", {
			actionCount: actions.length,
			dispatchTimestamp,
			renameActions: renameActions.map((a) => {
				const p = a.payload as { from: AnySplitPath; to: AnySplitPath };
				return {
					kind: a.kind,
					path: `${makeSystemPathForSplitPath(p.from)} → ${makeSystemPathForSplitPath(p.to)}`,
				};
			}),
			scrollActions: scrollRelatedActions.map((a) => ({
				kind: a.kind,
				path:
					"splitPath" in a.payload
						? makeSystemPathForSplitPath(a.payload.splitPath)
						: "unknown",
				transformName:
					a.kind === VaultActionKind.ProcessMdFile &&
					"transform" in a.payload
						? a.payload.transform.name
						: undefined,
			})),
			scrollRelatedCount: scrollRelatedActions.length,
		});

		if (actions.length === 0) {
			return ok(undefined);
		}

		// Ensure all requirements are met: check existence, filter invalid deletes, add missing creates
		const withEnsured = await this.ensureAllRequirementsMet(actions);
		const collapsed = await collapseActions(withEnsured);

		// Log ProcessMdFile keys after collapse (for duplicated go-back investigation)
		const collapsedProcess = collapsed.filter(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		);
		if (collapsedProcess.length > 0) {
			const keys = collapsedProcess.map((a) =>
				makeSystemPathForSplitPath(a.payload.splitPath),
			);
			const keyCounts = new Map<string, number>();
			for (const k of keys) {
				keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
			}
			const duplicatePaths = [...keyCounts.entries()].filter(
				([_, n]) => n > 1,
			);
			logger.info("[Dispatcher] ProcessMdFile keys after collapse", {
				duplicatePaths:
					duplicatePaths.length > 0 ? duplicatePaths : undefined,
				keys,
				processCount: collapsedProcess.length,
				uniqueKeys: keyCounts.size,
			});
		}

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

			// Extra logging for ProcessMdFile to debug race conditions
			const isScrollRelated =
				action.kind === VaultActionKind.ProcessMdFile &&
				"splitPath" in action.payload &&
				action.payload.splitPath.basename.includes("Untitled");
			const isRenameInvolvingUntitled =
				(action.kind === VaultActionKind.RenameMdFile ||
					action.kind === VaultActionKind.RenameFile ||
					action.kind === VaultActionKind.RenameFolder) &&
				"from" in action.payload &&
				"to" in action.payload &&
				((
					action.payload as { from: AnySplitPath }
				).from.basename.includes("Untitled") ||
					(
						action.payload as { to: AnySplitPath }
					).to.basename.includes("Untitled"));

			if (isScrollRelated) {
				logger.info("[Dispatcher] BEFORE ProcessMdFile execution", {
					batch: currentBatch,
					index: i,
					path: actionPath,
					timestamp: Date.now(),
					transformName:
						"transform" in action.payload
							? action.payload.transform.name
							: "before/after",
				});
			}
			if (isRenameInvolvingUntitled) {
				logger.info("[Dispatcher] BEFORE Rename execution", {
					batch: currentBatch,
					index: i,
					path: actionPath,
					timestamp: Date.now(),
				});
			}

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
					if (isScrollRelated) {
						logger.info(
							"[Dispatcher] AFTER ProcessMdFile execution",
							{
								batch: currentBatch,
								index: i,
								path: actionPath,
								result: "ok",
								timestamp: Date.now(),
							},
						);
					}
					if (isRenameInvolvingUntitled) {
						logger.info("[Dispatcher] AFTER Rename execution", {
							batch: currentBatch,
							index: i,
							path: actionPath,
							result: "ok",
							timestamp: Date.now(),
						});
					}
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
