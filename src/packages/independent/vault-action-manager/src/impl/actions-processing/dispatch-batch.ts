import type { Effect } from "effect";
import {
	type DispatchEffectFailure,
	EffectDispatchCoordinator,
} from "../../effect/dispatch-coordinator";
import type { VamShutdownError } from "../../effect/errors";
import type { VamRuntime } from "../../effect/runtime";
import { splitPathCodec } from "../../split-path-codec";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import { collapseActions } from "./collapse";
import { buildDependencyGraph } from "./dependency-detector";
import {
	ensureDestinationsExist,
	getDestinationsToCheck,
} from "./ensure-requirements-helpers";
import type { Executor } from "./executor";
import { topologicalSort } from "./topological-sort";

export type DispatchBatchEffectFailure = DispatchEffectFailure;

export type ExistenceChecker = {
	exists(splitPath: AnySplitPath): boolean | Promise<boolean>;
};

export type DispatchBatchOptions = {
	/** Maximum submitted batches processed in one drain cycle. */
	readonly maxBatches?: number;
};

/**
 * Plans Dispatch Batches with ordinary TypeScript and delegates their
 * coordination to the Effect-native single-consumer worker.
 */
export class DispatchBatchCoordinator {
	private readonly effectCoordinator: EffectDispatchCoordinator;

	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		private readonly existenceChecker: ExistenceChecker,
		runtime: VamRuntime,
		options: DispatchBatchOptions = {},
	) {
		this.effectCoordinator = new EffectDispatchCoordinator(
			runtime,
			{
				describePath: (action) => this.describePath(action),
				execute: (action) => this.executor.execute(action),
				plan: (actions) => this.plan(actions),
				registerSelfEvents: (actions) =>
					this.selfEventTracker.registerEffect(actions),
			},
			options,
		);
	}

	/** Effect-native dispatch seam used by the public facade. */
	dispatchEffect(
		actions: readonly VaultAction[],
	): Effect.Effect<void, DispatchEffectFailure> {
		return this.effectCoordinator.dispatchEffect(actions);
	}

	/** Effect-native idleness observation used by the testing adapter. */
	whenIdleEffect(): Effect.Effect<void> {
		return this.effectCoordinator.whenIdleEffect();
	}

	/** Effect-native finalizer. The active batch finishes; queued batches fail. */
	shutdownEffect(): Effect.Effect<void, VamShutdownError> {
		return this.effectCoordinator.shutdownEffect();
	}

	private async plan(
		actions: readonly VaultAction[],
	): Promise<readonly VaultAction[]> {
		const withRequirements = await this.ensureRequirements(actions);
		const collapsed = await collapseActions(withRequirements);
		const graph = buildDependencyGraph(collapsed);
		return topologicalSort(collapsed, graph);
	}

	private async ensureRequirements(
		actions: readonly VaultAction[],
	): Promise<VaultAction[]> {
		const executable: VaultAction[] = [];
		for (const action of actions) {
			switch (action.kind) {
				case VaultActionKind.TrashFolder:
				case VaultActionKind.TrashFile:
				case VaultActionKind.TrashMdFile: {
					if (
						await this.existenceChecker.exists(
							action.payload.splitPath,
						)
					)
						executable.push(action);
					break;
				}
				default:
					executable.push(action);
			}
		}

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
		const parsed = splitPathCodec.parse(path);
		return parsed.kind === "Folder" ? parsed : null;
	}

	private toMdFile(path: string): SplitPathToMdFile | null {
		const parsed = splitPathCodec.parse(path);
		return parsed.kind === "MdFile" ? parsed : null;
	}

	private describePath(action: VaultAction): string {
		switch (action.kind) {
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
			case VaultActionKind.RenameFolder:
				return `${splitPathCodec.format(action.payload.from)} → ${splitPathCodec.format(action.payload.to)}`;
			default:
				return splitPathCodec.format(action.payload.splitPath);
		}
	}
}
