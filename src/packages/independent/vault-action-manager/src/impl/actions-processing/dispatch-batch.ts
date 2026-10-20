import type { Effect } from "effect";
import {
	type AnyDispatchEffectFailure,
	DispatchBatchWorker,
	type DispatchEffectFailure,
	type DispatchOptions,
	type StopOnFirstFailureDispatchFailure,
} from "../../effect/dispatch-coordinator";
import type { VamShutdownError } from "../../effect/errors";
import type { VamRuntime } from "../../effect/runtime";
import type { VaultAction } from "../../types/vault-action";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import type { Executor } from "./executor";

export type DispatchBatchEffectFailure = DispatchEffectFailure;
export type {
	AnyDispatchEffectFailure,
	DispatchOptions,
	StopOnFirstFailureDispatchFailure,
};

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
	): Effect.Effect<void, DispatchEffectFailure>;
	dispatchEffect(
		actions: readonly VaultAction[],
		options: DispatchOptions & { readonly stopOnFirstFailure: true },
	): Effect.Effect<void, StopOnFirstFailureDispatchFailure>;
	dispatchEffect(
		actions: readonly VaultAction[],
		options?: DispatchOptions,
	): Effect.Effect<void, AnyDispatchEffectFailure>;
	dispatchEffect(
		actions: readonly VaultAction[],
		options?: DispatchOptions,
	): Effect.Effect<void, AnyDispatchEffectFailure> {
		return this.worker.dispatchEffect(actions, options);
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
