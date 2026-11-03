/**
 * Which Scrolls a Classify run is resolving in (#116). A run commits its
 * occurrences before it writes their links, so until it ends a Scroll can
 * hold refs whose links are not there yet, and the editor saves the links
 * it wrote a moment after it ends. The unlink observer leaves a busy Scroll
 * alone, and looks again a quiet period after its last run ended. A run
 * also commits Readings no link names yet, in a Scroll no one can tell in
 * advance, so the Reading lifetime waits for every Scroll to be idle.
 */
import { Clock, Deferred, Effect, Ref } from "effect";

export type ScrollActivity = {
	/** Counts `effect` as a run on the Scroll at `path` while it runs, however it ends. */
	readonly during: <A, E, R>(
		path: string,
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
	/** Marks a run on the Scroll at `path`; run what it gives when the run ends. */
	readonly begin: (path: string) => Effect.Effect<Effect.Effect<void>>;
	/**
	 * Whether a run is going on the Scroll at `path`. Read synchronously, as
	 * a store transaction's plan reads it under the store's lock.
	 */
	readonly busy: (path: string) => boolean;
	/** Ends once no run is going on the Scroll at `path`. */
	readonly idle: (path: string) => Effect.Effect<void>;
	/**
	 * When the last run on the Scroll at `path` ended, by `Clock`, if one
	 * did. Read synchronously, as `busy` is.
	 */
	readonly endedAt: (path: string) => number | undefined;
	/** Whether a run is going on any Scroll. Read synchronously, as `busy` is. */
	readonly busyAnywhere: () => boolean;
	/** When the last run on any Scroll ended, by `Clock`, if one did. */
	readonly lastEndedAt: () => number | undefined;
};

/** The runs going on one Scroll, and what its waiters wait on. */
type Running = {
	readonly count: number;
	readonly idle: Deferred.Deferred<void>;
};

type ActivityState = {
	readonly running: ReadonlyMap<string, Running>;
	readonly ended: ReadonlyMap<string, number>;
};

const withEntry = <V>(
	map: ReadonlyMap<string, V>,
	key: string,
	value: V | undefined,
): ReadonlyMap<string, V> => {
	const next = new Map(map);
	if (value === undefined) next.delete(key);
	else next.set(key, value);
	return next;
};

export function createScrollActivity(): ScrollActivity {
	const state = Ref.makeUnsafe<ActivityState>({
		ended: new Map(),
		running: new Map(),
	});

	const end = (path: string) =>
		Effect.gen(function* () {
			const now = yield* Clock.currentTimeMillis;
			const idle = yield* Ref.modify(
				state,
				({
					ended,
					running,
				}): [Deferred.Deferred<void> | undefined, ActivityState] => {
					const current = running.get(path);
					const left = (current?.count ?? 1) - 1;
					return [
						left > 0 ? undefined : current?.idle,
						{
							ended: withEntry(ended, path, now),
							running: withEntry(
								running,
								path,
								left > 0 && current
									? { count: left, idle: current.idle }
									: undefined,
							),
						},
					];
				},
			);
			if (idle) yield* Deferred.succeed(idle, undefined);
		});

	const begin = (path: string) =>
		Ref.update(state, ({ ended, running }) => {
			const current = running.get(path);
			return {
				ended,
				running: withEntry(running, path, {
					count: (current?.count ?? 0) + 1,
					idle: current?.idle ?? Deferred.makeUnsafe<void>(),
				}),
			};
		}).pipe(
			Effect.map(() => {
				let ended = false;
				// Ends the run once, however often it is run.
				return Effect.suspend(() => {
					if (ended) return Effect.void;
					ended = true;
					return end(path);
				});
			}),
		);

	return {
		begin,
		busy: (path) => Ref.getUnsafe(state).running.has(path),
		busyAnywhere: () => Ref.getUnsafe(state).running.size > 0,
		during: (path, effect) =>
			Effect.acquireUseRelease(
				begin(path),
				() => effect,
				(ended) => ended,
			),
		endedAt: (path) => Ref.getUnsafe(state).ended.get(path),
		idle: (path) =>
			Effect.suspend(() => {
				const running = Ref.getUnsafe(state).running.get(path);
				return running ? Deferred.await(running.idle) : Effect.void;
			}),
		lastEndedAt: () => {
			let last: number | undefined;
			for (const at of Ref.getUnsafe(state).ended.values())
				if (last === undefined || at > last) last = at;
			return last;
		},
	};
}
