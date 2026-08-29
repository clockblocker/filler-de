import { err, ok, type Result } from "neverthrow";
import {
	decrementPending,
	incrementPending,
} from "../../internal/idle-tracker";
import { logger } from "../../internal/logger";
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

export type ExistenceChecker = {
	exists(splitPath: AnySplitPath): boolean;
};

export type DispatchBatchOptions = {
	/** Maximum submitted batches processed in one drain cycle. */
	maxBatches?: number;
};

type SubmittedBatch = {
	actions: readonly VaultAction[];
	resolve(result: DispatchResult): void;
};

/**
 * Coordinates the complete lifecycle of submitted Vault Action batches.
 *
 * Planning, ordering, Self Event registration, execution, error attribution,
 * and scheduling all stay behind the `dispatch` interface. Each caller owns a
 * distinct submitted batch and receives the result for that batch only.
 */
export class DispatchBatchCoordinator {
	private readonly submitted: SubmittedBatch[] = [];
	private readonly idleWaiters = new Set<() => void>();
	private readonly maxBatches: number;
	private draining = false;

	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		private readonly existenceChecker: ExistenceChecker,
		options: DispatchBatchOptions = {},
	) {
		this.maxBatches = options.maxBatches ?? 10;
	}

	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		return new Promise((resolve) => {
			this.submitted.push({ actions: [...actions], resolve });
			void this.drain();
		});
	}

	/** Used by the testing adapter to observe the real coordinator. */
	whenIdle(): Promise<void> {
		if (!this.draining && this.submitted.length === 0) {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			this.idleWaiters.add(resolve);
		});
	}

	private async drain(): Promise<void> {
		if (this.draining) return;

		this.draining = true;
		incrementPending();
		let processedCount = 0;

		try {
			while (this.submitted.length > 0) {
				if (processedCount >= this.maxBatches) {
					this.rejectOverflowedBatches();
					break;
				}

				const batch = this.submitted.shift();
				if (!batch) break;

				processedCount++;
				batch.resolve(await this.execute(batch.actions));
			}
		} finally {
			this.draining = false;
			decrementPending();

			if (this.submitted.length > 0) {
				void this.drain();
			} else {
				const waiters = [...this.idleWaiters];
				this.idleWaiters.clear();
				for (const resolve of waiters) resolve();
			}
		}
	}

	private rejectOverflowedBatches(): void {
		const overflowed = this.submitted.splice(0);
		const droppedActionCount = overflowed.reduce(
			(count, batch) => count + batch.actions.length,
			0,
		);

		logger.warn(
			`[DispatchBatch] Batch limit (${this.maxBatches}) reached, dropping ${droppedActionCount} queued actions from ${overflowed.length} submitted batches`,
		);

		for (const batch of overflowed) {
			const representative = batch.actions[0] ?? ({} as VaultAction);
			batch.resolve(
				err([
					{
						action: representative,
						error: `Dispatch Batch overflow: batch limit ${this.maxBatches} reached, ${batch.actions.length} actions dropped`,
					},
				]),
			);
		}
	}

	private async execute(
		actions: readonly VaultAction[],
	): Promise<DispatchResult> {
		if (actions.length === 0) return ok(undefined);

		let planned: VaultAction[];
		try {
			planned = await this.plan(actions);
			this.selfEventTracker.register(planned);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			const action = actions[0] ?? ({} as VaultAction);
			logger.error("[DispatchBatch] Planning failed", { error: message });
			return err([{ action, error: `EXCEPTION: ${message}` }]);
		}

		const errors: DispatchError[] = [];
		for (const action of planned) {
			try {
				const result = await this.executor.execute(action);
				if (result.isErr()) {
					const failure = { action, error: result.error };
					errors.push(failure);
					logger.error("[DispatchBatch] Action failed", {
						error: result.error,
						kind: action.kind,
						path: this.describePath(action),
					});
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				errors.push({ action, error: `EXCEPTION: ${message}` });
				logger.error("[DispatchBatch] Action threw exception", {
					error: message,
					kind: action.kind,
					path: this.describePath(action),
				});
			}
		}

		return errors.length > 0 ? err(errors) : ok(undefined);
	}

	private async plan(
		actions: readonly VaultAction[],
	): Promise<VaultAction[]> {
		const withRequirements = await this.ensureRequirements(actions);
		const collapsed = await collapseActions(withRequirements);
		const graph = buildDependencyGraph(collapsed);
		return topologicalSort(collapsed, graph);
	}

	private async ensureRequirements(
		actions: readonly VaultAction[],
	): Promise<VaultAction[]> {
		const executable = actions.filter((action) => {
			switch (action.kind) {
				case VaultActionKind.TrashFolder:
				case VaultActionKind.TrashFile:
				case VaultActionKind.TrashMdFile:
					return this.existenceChecker.exists(
						action.payload.splitPath,
					);
				default:
					return true;
			}
		});

		const destinations = getDestinationsToCheck(
			executable,
			(path) => this.toFolder(path),
			(key) => this.toMdFile(key),
		);
		const requiredActions = await ensureDestinationsExist(
			destinations,
			this.existenceChecker,
			(path) => this.toFolder(path),
			(key) => this.toMdFile(key),
			executable,
		);

		return [...executable, ...requiredActions];
	}

	private toFolder(path: string): SplitPathToFolder | null {
		const parsed = makeSplitPath(path);
		return parsed.kind === "Folder" ? parsed : null;
	}

	private toMdFile(path: string): SplitPathToMdFile | null {
		const parsed = makeSplitPath(path);
		return parsed.kind === "MdFile" ? parsed : null;
	}

	private describePath(action: VaultAction): string {
		switch (action.kind) {
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
			case VaultActionKind.RenameFolder:
				return `${makeSystemPathForSplitPath(action.payload.from)} → ${makeSystemPathForSplitPath(action.payload.to)}`;
			default:
				return makeSystemPathForSplitPath(action.payload.splitPath);
		}
	}
}
