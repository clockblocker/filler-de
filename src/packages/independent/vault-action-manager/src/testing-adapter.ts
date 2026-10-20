import { Clock, Effect } from "effect";
import { VaultIo } from "./effect/ports";
import type { VamRuntime } from "./effect/runtime";
import type { DispatchBatchCoordinator } from "./impl/actions-processing/dispatch-batch";
import type { SelfEventTracker } from "./impl/event-processing/self-event-tracker";

/** Bounds settling when subscribers keep provoking each other's windows. */
const MAX_SETTLE_ROUNDS = 100;

/** The idle barrier of one VaultObservation channel. */
type SettleableObservation = {
	readonly flushPendingEffect: () => Effect.Effect<void>;
	readonly publishedWindowCountEffect: () => Effect.Effect<number>;
	readonly whenIdleEffect: () => Effect.Effect<void>;
};

/**
 * Readiness adapter over the same runtime and object graph used in production.
 */
export class VaultActionManagerTestingAdapter {
	constructor(
		private readonly runtime: VamRuntime,
		private readonly dispatches: DispatchBatchCoordinator,
		private readonly observations: readonly SettleableObservation[],
		private readonly selfEvents: SelfEventTracker,
	) {}

	readonly whenSettled = Effect.fn(
		"VaultActionManagerTestingAdapter.whenSettled",
	)(function* (this: VaultActionManagerTestingAdapter) {
		yield* this.runtime.provide(this.awaitSettled());
	});

	private readonly awaitSettled = Effect.fn(
		"VaultActionManagerTestingAdapter.awaitSettled",
	)(function* (this: VaultActionManagerTestingAdapter) {
		// Settle to a fixed point. Each round waits for dispatch to go idle,
		// turns every channel's current window into subscriber work, and waits
		// for the Dispatch Batches those subscribers submit. Their writes can
		// open new windows on either channel, so rounds repeat until one
		// publishes no window at all.
		let published = yield* this.publishedWindowCount();
		for (let round = 1; ; round++) {
			yield* this.dispatches.whenIdleEffect();
			for (const observation of this.observations) {
				yield* observation.flushPendingEffect();
				yield* observation.whenIdleEffect();
			}
			yield* this.dispatches.whenIdleEffect();

			const next = yield* this.publishedWindowCount();
			if (next === published) break;
			published = next;
			if (round >= MAX_SETTLE_ROUNDS) {
				yield* Effect.logWarning(
					`[VaultActionManagerTestingAdapter] Still publishing windows after ${MAX_SETTLE_ROUNDS} settle rounds`,
				);
				break;
			}
		}

		const filePaths = yield* this.selfEvents.getRegisteredFilePathsEffect();
		yield* this.selfEvents.waitForAllRegisteredEffect();
		yield* this.verifyFilesQueryableEffect(filePaths);
	});

	private readonly publishedWindowCount = Effect.fn(
		"VaultActionManagerTestingAdapter.publishedWindowCount",
	)(function* (this: VaultActionManagerTestingAdapter) {
		let total = 0;
		for (const observation of this.observations) {
			total += yield* observation.publishedWindowCountEffect();
		}
		return total;
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
