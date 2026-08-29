import type { Effect } from "effect";
import {
	DispatchBatchWorker,
	type DispatchEffectFailure,
} from "../../effect/dispatch-coordinator";
import type { VamShutdownError } from "../../effect/errors";
import type { VamRuntime } from "../../effect/runtime";
import type { VaultAction } from "../../types/vault-action";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import type { Executor } from "./executor";

export type DispatchBatchEffectFailure = DispatchEffectFailure;

export type DispatchBatchOptions = {
	/** Maximum submitted batches processed in one drain cycle. */
	readonly maxBatches?: number;
};

/**
 * Single caller/test interface over the Effect-native Dispatch Batch worker.
 */
export class DispatchBatchCoordinator {
	private readonly worker: DispatchBatchWorker;

	constructor(
		executor: Executor,
		selfEventTracker: SelfEventTracker,
		runtime: VamRuntime,
		options: DispatchBatchOptions = {},
	) {
		this.worker = new DispatchBatchWorker(
			runtime,
			executor,
			selfEventTracker,
			options,
		);
	}

	/** Effect-native dispatch seam used by the public facade. */
	dispatchEffect(
		actions: readonly VaultAction[],
	): Effect.Effect<void, DispatchEffectFailure> {
		return this.worker.dispatchEffect(actions);
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
