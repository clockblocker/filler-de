import { Effect, Semaphore } from "effect";

import {
	decrementPending,
	incrementPending,
} from "../../../utils/idle-tracker";

/**
 * Serializes effectful vault work that must not interleave.
 *
 * Each enqueue waits for its own item to finish and preserves the processor's
 * typed error. A failed item releases the permit, so subsequent work can
 * continue normally.
 */
export class VaultActionQueue<T, E> {
	private constructor(
		private readonly processor: (item: T) => Effect.Effect<void, E>,
		private readonly semaphore: Semaphore.Semaphore,
	) {}

	static readonly make = Effect.fn("VaultActionQueue.make")(function* <T, E>(
		processor: (item: T) => Effect.Effect<void, E>,
	): Effect.fn.Return<VaultActionQueue<T, E>> {
		const semaphore = yield* Semaphore.make(1);
		return new VaultActionQueue(processor, semaphore);
	});

	readonly enqueue = Effect.fn("VaultActionQueue.enqueue")(function* (
		this: VaultActionQueue<T, E>,
		item: T,
	): Effect.fn.Return<void, E> {
		yield* this.semaphore.withPermit(
			Effect.acquireUseRelease(
				Effect.sync(incrementPending),
				() => this.processor(item),
				() => Effect.sync(decrementPending),
			),
		);
	});

	/** Waits for all enqueues registered before this effect to finish. */
	readonly waitForDrain = Effect.fn("VaultActionQueue.waitForDrain")(
		function* (this: VaultActionQueue<T, E>): Effect.fn.Return<void> {
			yield* this.semaphore.withPermit(Effect.void);
		},
	);
}
