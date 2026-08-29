import { Cause, Clock, Effect, Exit } from "effect";
import { VaultIo } from "./effect/ports";
import type { VamRuntime } from "./effect/runtime";
import type { DispatchBatchCoordinator } from "./impl/actions-processing/dispatch-batch";
import type { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import type { VaultObservation } from "./impl/event-processing/vault-observation";

/**
 * Readiness adapter over the same runtime and object graph used in production.
 */
export class VaultActionManagerTestingAdapter {
	constructor(
		private readonly runtime: VamRuntime,
		private readonly dispatches: DispatchBatchCoordinator,
		private readonly observation: VaultObservation,
		private readonly selfEvents: SelfEventTracker,
	) {}

	async whenSettled(): Promise<void> {
		const exit = await this.runtime.runPromiseExit(
			this.whenSettledEffect(),
		);
		if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
	}

	private readonly whenSettledEffect = Effect.fn(
		"VaultActionManagerTestingAdapter.whenSettled",
	)(function* (this: VaultActionManagerTestingAdapter) {
		yield* this.dispatches.whenIdleEffect();

		// Turn the current quiet window into subscriber work, then include any
		// Dispatch Batches those subscribers submit.
		yield* this.observation.flushPendingEffect();
		yield* this.observation.whenIdleEffect();
		yield* this.dispatches.whenIdleEffect();

		const filePaths = yield* this.selfEvents.getRegisteredFilePathsEffect();
		yield* this.selfEvents.waitForAllRegisteredEffect();
		yield* this.verifyFilesQueryableEffect(filePaths);
	});

	private readonly verifyFilesQueryableEffect = Effect.fn(
		"VaultActionManagerTestingAdapter.verifyFilesQueryable",
	)(function* (filePaths: readonly string[]) {
		return Effect.gen(function* () {
			if (filePaths.length === 0) return;

			const vault = yield* VaultIo;
			const maxTimeoutMs = 10_000;
			const startedAt = yield* Clock.currentTimeMillis;
			let intervalMs = 50;
			let checkCount = 0;

			yield* Effect.sleep(100);
			while (
				(yield* Clock.currentTimeMillis) - startedAt <
				maxTimeoutMs
			) {
				const missing = yield* Effect.filter(filePaths, (path) =>
					vault
						.getAbstractFileByPath(path)
						.pipe(Effect.map((file) => file === null)),
				);
				if (missing.length === 0) return;

				checkCount++;
				if (checkCount > 10) {
					intervalMs = Math.min(intervalMs * 1.2, 200);
				}
				yield* Effect.sleep(intervalMs);
			}

			const missing = yield* Effect.filter(filePaths, (path) =>
				vault
					.getAbstractFileByPath(path)
					.pipe(Effect.map((file) => file === null)),
			);
			if (missing.length > 0) {
				yield* Effect.logWarning(
					`[VaultActionManagerTestingAdapter] Files not queryable after ${maxTimeoutMs}ms:`,
					missing,
				);
			}
		});
	});
}
