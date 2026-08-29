import { Clock, Deferred, Effect, Option, Queue } from "effect";
import type { VaultEvent } from "../../../..";
import type { BulkWindow } from "../types/bulk/bulk-window";

export type EventAccumulatorCommand =
	| { readonly _tag: "Event"; readonly event: VaultEvent }
	| { readonly _tag: "Flush"; readonly completed: Deferred.Deferred<void> }
	| { readonly _tag: "Settled"; readonly completed: Deferred.Deferred<void> };

export type EventAccumulatorOptions = {
	/** Flush when no new Vault Event arrives for this long. */
	readonly quietWindowMs: number;
	/** Flush even while Vault Events continue to arrive. */
	readonly maxWindowMs: number;
};

type EventWindow = {
	readonly events: ReadonlyArray<VaultEvent>;
	readonly startedAt: number;
};

/**
 * Runs the single scoped observation-window worker.
 *
 * The worker is the only consumer of the intake queue, so event ordering and
 * window boundaries do not depend on callback or subscriber scheduling.
 */
export const runEventAccumulator = Effect.fn("runEventAccumulator")(function* (
	intake: Queue.Dequeue<EventAccumulatorCommand>,
	options: EventAccumulatorOptions,
	onFlush: (window: BulkWindow) => Effect.Effect<void>,
	onSettled: Effect.Effect<void>,
): Effect.fn.Return<never> {
	const flushWindow = Effect.fn("runEventAccumulator.flushWindow")(function* (
		window: EventWindow,
	): Effect.fn.Return<void> {
		const endedAt = yield* Clock.currentTimeMillis;
		yield* onFlush({
			allObsidianEvents: [...window.events],
			debug: { endedAt, startedAt: window.startedAt },
		});
	});

	const completeCommand = Effect.fn("runEventAccumulator.completeCommand")(
		function* (
			command: Extract<
				EventAccumulatorCommand,
				{ readonly _tag: "Flush" | "Settled" }
			>,
		): Effect.fn.Return<void> {
			if (command._tag === "Settled") yield* onSettled;
			yield* Deferred.succeed(command.completed, undefined);
		},
	);

	const collectWindow = Effect.fn("runEventAccumulator.collectWindow")(
		function* (window: EventWindow): Effect.fn.Return<void> {
			const now = yield* Clock.currentTimeMillis;
			const remainingMaximum = Math.max(
				0,
				options.maxWindowMs - (now - window.startedAt),
			);
			const waitFor = Math.min(options.quietWindowMs, remainingMaximum);

			const next = yield* Queue.take(intake).pipe(
				Effect.timeoutOption(waitFor),
			);
			if (Option.isNone(next)) {
				yield* flushWindow(window);
				return;
			}

			const command = next.value;
			if (command._tag !== "Event") {
				yield* flushWindow(window);
				yield* completeCommand(command);
				return;
			}

			const receivedAt = yield* Clock.currentTimeMillis;
			const nextWindow = {
				events: [...window.events, command.event],
				startedAt: window.startedAt,
			};
			if (receivedAt - window.startedAt >= options.maxWindowMs) {
				yield* flushWindow(nextWindow);
				return;
			}

			yield* collectWindow(nextWindow);
		},
	);

	while (true) {
		const command = yield* Queue.take(intake);
		if (command._tag !== "Event") {
			yield* completeCommand(command);
			continue;
		}

		const startedAt = yield* Clock.currentTimeMillis;
		yield* collectWindow({ events: [command.event], startedAt });
	}
});
