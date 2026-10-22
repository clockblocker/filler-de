import type { Effect } from "effect";
import {
	DispatchBatchWorker,
	type DispatchOptions,
} from "../../effect/dispatch-coordinator";
import type {
	VamDispatchFailure,
	VamDispatchReport,
} from "../../effect/dispatch-report";
import type { VamShutdownError } from "../../effect/errors";
import type { VamRuntime } from "../../effect/runtime";
import type { VaultAction } from "../../types/vault-action";
import type { LinkRewriteWindows } from "../event-processing/link-rewrite-windows";
import type { SelfEventTracker } from "../event-processing/self-event-tracker";
import type { ProtectedPaths } from "../protected-paths";
import type { Executor } from "./executor";

export type { DispatchOptions };

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
	/** Records when link-updating renames run. */
	readonly linkRewrites?: LinkRewriteWindows;
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
		options?: DispatchOptions,
	): Effect.Effect<VamDispatchReport, VamDispatchFailure> {
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
