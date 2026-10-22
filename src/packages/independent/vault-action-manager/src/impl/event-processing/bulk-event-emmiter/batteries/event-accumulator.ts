import { Clock, Deferred, Effect, Option, Queue } from "effect";
import type { VaultEvent } from "../../../..";
import type { BulkWindow } from "../types/bulk/bulk-window";

export type EventAccumulatorCommand<Ev = VaultEvent> =
	| { readonly _tag: "Event"; readonly event: Ev }
	| { readonly _tag: "Flush"; readonly completed: Deferred.Deferred<void> }
	/**
	 * Closes the open window now, then runs `run`. The worker takes nothing
	 * else until `run` ends, so `run` must not wait on subscribers: a
	 * gated one takes nothing before it starts.
	 */
	| { readonly _tag: "Settled"; readonly run: Effect.Effect<void> }
	/**
	 * Runs `run` once every event queued before it is published: after the
	 * open window closes, on its own deadlines, or at once when none is
	 * open. It neither opens nor extends a window.
	 */
	| { readonly _tag: "AfterWindow"; readonly run: Effect.Effect<void> };

export type EventAccumulatorOptions = {
	/** Flush when no new Vault Event arrives for this long. */
	readonly quietWindowMs: number;
	/** Flush even while Vault Events continue to arrive. */
	readonly maxWindowMs: number;
};

type EventWindow<Ev> = {
	/** What runs once the window is published. */
	readonly after: ReadonlyArray<Effect.Effect<void>>;
	readonly events: ReadonlyArray<Ev>;
	/** When the latest event arrived; the quiet deadline counts from it. */
	readonly lastEventAt: number;
	readonly startedAt: number;
};

/**
 * Runs the single scoped observation-window worker.
 *
 * The worker is the only consumer of the intake queue, so event ordering and
 * window boundaries do not depend on callback or subscriber scheduling.
 */
export const runEventAccumulator = Effect.fn("runEventAccumulator")(function* <
	Ev,
>(
	intake: Queue.Dequeue<EventAccumulatorCommand<Ev>>,
	options: EventAccumulatorOptions,
	onFlush: (window: BulkWindow<Ev>) => Effect.Effect<void>,
): Effect.fn.Return<never> {
	const flushWindow = Effect.fn("runEventAccumulator.flushWindow")(function* (
		window: EventWindow<Ev>,
	): Effect.fn.Return<void> {
		const endedAt = yield* Clock.currentTimeMillis;
		yield* onFlush({
			allObsidianEvents: [...window.events],
			debug: { endedAt, startedAt: window.startedAt },
		});
		for (const run of window.after) yield* run;
	});

	const completeCommand = Effect.fn("runEventAccumulator.completeCommand")(
		function* (
			command: Extract<
				EventAccumulatorCommand<Ev>,
				{ readonly _tag: "Flush" | "Settled" | "AfterWindow" }
			>,
		): Effect.fn.Return<void> {
			if (command._tag !== "Flush") return yield* command.run;
			yield* Deferred.succeed(command.completed, undefined);
		},
	);

	const collectWindow = Effect.fn("runEventAccumulator.collectWindow")(
		function* (window: EventWindow<Ev>): Effect.fn.Return<void> {
			const now = yield* Clock.currentTimeMillis;
			const deadline = Math.min(
				window.lastEventAt + options.quietWindowMs,
				window.startedAt + options.maxWindowMs,
			);
			const waitFor = Math.max(0, deadline - now);

			const next = yield* Queue.take(intake).pipe(
				Effect.timeoutOption(waitFor),
			);
			if (Option.isNone(next)) {
				yield* flushWindow(window);
				return;
			}

			const command = next.value;
			if (command._tag === "AfterWindow") {
				yield* collectWindow({
					...window,
					after: [...window.after, command.run],
				});
				return;
			}
			if (command._tag !== "Event") {
				yield* flushWindow(window);
				yield* completeCommand(command);
				return;
			}

			const receivedAt = yield* Clock.currentTimeMillis;
			const nextWindow = {
				...window,
				events: [...window.events, command.event],
				lastEventAt: receivedAt,
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
		yield* collectWindow({
			after: [],
			events: [command.event],
			lastEventAt: startedAt,
			startedAt,
		});
	}
});
