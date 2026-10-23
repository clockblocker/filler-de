import { Effect, Semaphore } from "effect";

import { IdleTracker } from "../../../utils/idle-tracker";

/**
 * Serializes effectful vault work that must not interleave.
 *
 * `run` waits for its turn, runs the work alone, and answers what it
 * answered: its value, its typed error. A failed item releases the permit,
 * so subsequent work can continue normally.
 */
export class VaultActionQueue {
	private constructor(private readonly semaphore: Semaphore.Semaphore) {}

	static readonly make: Effect.Effect<VaultActionQueue> = Effect.map(
		Semaphore.make(1),
		(semaphore) => new VaultActionQueue(semaphore),
	);

	/** Runs `work` once every item queued before it is done, as pending work. */
	readonly run = <A, E, R>(
		work: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E, R> =>
		Effect.flatMap(IdleTracker, (idle) =>
			this.semaphore.withPermit(idle.track(work)),
		).pipe(Effect.withSpan("VaultActionQueue.run"));

	/** Waits for all items queued before this effect to finish. */
	readonly waitForDrain = Effect.fn("VaultActionQueue.waitForDrain")(
		function* (this: VaultActionQueue): Effect.fn.Return<void> {
			yield* this.semaphore.withPermit(Effect.void);
		},
	);
}
