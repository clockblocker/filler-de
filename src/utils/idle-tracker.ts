/**
 * The plugin's pending work, which the E2E driver waits out before it reads
 * the vault (`whenIdle`). Work that outlives the step that started it
 * counts itself while it runs: a lifecycle command, a command, a Librarian
 * queue item, a Knowledge run, an unlink check, a click the event layer
 * handles.
 *
 * The count is a `Ref`, and each change is published, so `whenIdle` waits
 * on its changes instead of polling it. A change is one synchronous step,
 * with no lock to wait for, so the plain callbacks that count through the
 * runtime's `readSync` never see it go async. The plugin runtime provides
 * one tracker (`IdleTrackerLive`); code run without it, such as most unit
 * tests, counts nothing.
 */
import {
	Context,
	type Duration,
	Effect,
	Layer,
	MutableRef,
	PubSub,
	Ref,
	Stream,
} from "effect";

export type IdleTrackerService = {
	/** Work began; `end` once it is done. */
	readonly start: Effect.Effect<void>;
	readonly end: Effect.Effect<void>;
	/** Counts `effect` while it runs, however it ends. */
	readonly track: <A, E, R>(
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
	readonly pending: Effect.Effect<number>;
	/**
	 * Ends once no work is pending and none began for `grace` (one second
	 * by default): work that starts another as it ends is waited out too.
	 */
	readonly whenIdle: (grace?: Duration.Input) => Effect.Effect<void>;
};

const GRACE: Duration.Input = "1 second";

const untracked: IdleTrackerService = {
	end: Effect.void,
	pending: Effect.succeed(0),
	start: Effect.void,
	track: (effect) => effect,
	whenIdle: () => Effect.void,
};

/** A tracker of its own, as the plugin runtime holds one. */
export const makeIdleTracker: Effect.Effect<IdleTrackerService> = Effect.map(
	PubSub.unbounded<number>({ replay: 1 }),
	(changes) => {
		const count = Ref.makeUnsafe(0);
		PubSub.publishUnsafe(changes, 0);
		/** Changes the count and publishes it, in one step. */
		const change = (by: 1 | -1) =>
			Effect.sync(() => {
				PubSub.publishUnsafe(
					changes,
					MutableRef.updateAndGet(count.ref, (n) =>
						Math.max(0, n + by),
					),
				);
			});
		const start = change(1);
		const end = change(-1);
		return {
			end,
			pending: Ref.get(count),
			start,
			track: (effect) =>
				Effect.acquireUseRelease(
					start,
					() => effect,
					() => end,
				),
			// The count's changes, the current one first: idle once a
			// zero is followed by no change for `grace`.
			whenIdle: (grace = GRACE) =>
				Stream.fromPubSub(changes).pipe(
					Stream.debounce(grace),
					Stream.filter((n) => n === 0),
					Stream.runHead,
					Effect.asVoid,
				),
		};
	},
);

/** The plugin's idle tracker; by default, none that counts. */
export const IdleTracker = Context.Reference<IdleTrackerService>(
	"textfresser/utils/IdleTracker",
	{ defaultValue: () => untracked },
);

export const IdleTrackerLive = Layer.effect(IdleTracker, makeIdleTracker);

/** Whether the E2E driver runs the plugin: only then does `whenIdle` wait. */
export function isE2EMode(): boolean {
	if (typeof process !== "undefined" && process.env.E2E === "1") return true;
	if (typeof window !== "undefined")
		return (
			(window as unknown as { __E2E_MODE?: boolean }).__E2E_MODE === true
		);
	return false;
}
