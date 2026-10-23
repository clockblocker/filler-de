import type { Effect } from "effect";
import {
	DispatchBatchWorker,
	type DispatchOptions,
	type DispatchRequest,
} from "../../effect/dispatch-coordinator";
import type {
	VamDispatchFailure,
	VamDispatchReport,
} from "../../effect/dispatch-report";
import type { VamShutdownError } from "../../effect/errors";
import type { VamLiveServices } from "../../effect/ports";
import type { VaultAction } from "../../types/vault-action";
import type { LinkUpdates } from "../event-processing/link-updates";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import type { ProtectedPaths } from "../protected-paths";
import type { Executor } from "./executor";

export type { DispatchOptions, DispatchRequest };

export type DispatchBatchOptions = {
	/**
	 * Maximum submitted batches queued behind the active one. Later
	 * submissions wait for space in submission order; none are dropped.
	 */
	readonly queueCapacity?: number;
	/**
	 * Test signal, called once per accepted submission after it is queued or
	 * appended to the waiting list.
	 */
	readonly onSubmitted?: (placement: "queued" | "waiting") => void;
	/**
	 * Paths no batch may change. A submission naming one fails with
	 * `VamProtectedPathError` before anything in it runs.
	 */
	readonly protectedPaths?: ProtectedPaths;
	/** Predicts and labels what link-updating renames make Obsidian rewrite. */
	readonly linkUpdates?: LinkUpdates;
};

/**
 * Single caller/test interface over the Effect-native Dispatch Batch worker.
 */
export class DispatchBatchCoordinator {
	private readonly worker: DispatchBatchWorker;

	constructor(
		executor: Executor,
		selfEventTracker: SelfEventTracker,
		options: DispatchBatchOptions = {},
	) {
		this.worker = new DispatchBatchWorker(
			executor,
			selfEventTracker,
			options,
		);
	}

	/**
	 * The worker loop, to fork once in the owner's scope. Dispatches wait
	 * until it runs.
	 */
	get run(): Effect.Effect<void, never, VamLiveServices> {
		return this.worker.run;
	}

	/** Effect-native dispatch seam used by the public facade. */
	dispatchEffect(
		actions: readonly VaultAction[],
		request: DispatchRequest,
	): Effect.Effect<VamDispatchReport, VamDispatchFailure> {
		return this.worker.dispatchEffect(actions, request);
	}

	/** Effect-native idleness observation used by the testing adapter. */
	whenIdleEffect(): Effect.Effect<void> {
		return this.worker.whenIdleEffect();
	}

	/** Effect-native finalizer. The active batch finishes; queued batches fail. */
	shutdownEffect(): Effect.Effect<void, VamShutdownError> {
		return this.worker.shutdownEffect();
	}
}
