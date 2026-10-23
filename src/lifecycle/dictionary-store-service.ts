/**
 * The dictionary store over `Worter/` as a service: built on first use, a
 * build that failed (a scan of `Worter/` that could not finish) is tried
 * again on the next use, and once the plugin unloads it is closed and
 * answers no more.
 */
import { Effect } from "effect";
import type { EffectRunner } from "../runtime/plugin-runtime";
import { ServiceState } from "./service-state";

export type DictionaryStoreService<Store> = {
	readonly state: () => ServiceState;
	/** The store, built on first use. Rejects once the plugin unloaded. */
	readonly get: () => Promise<Store>;
	/**
	 * Closes the store. A build still under way is closed once it ends,
	 * without waiting for it, as before VAM is disposed it would fail anyway.
	 */
	readonly stop: Effect.Effect<void, unknown>;
};

export function createDictionaryStoreService<Store>(deps: {
	readonly build: () => Effect.Effect<Store, unknown>;
	readonly close: (store: Store) => Effect.Effect<void, unknown>;
	readonly onBuildFailed: (error: unknown) => void;
	/** Runs the build and a late close on the plugin runtime. */
	readonly runtime: EffectRunner<unknown>;
}): DictionaryStoreService<Store> {
	let state: ServiceState = ServiceState.idle;
	let building: Promise<Store> | null = null;

	const get = (): Promise<Store> => {
		if (state.kind === "Stopped")
			return Promise.reject(new Error("the plugin has unloaded"));
		if (building) return building;
		state = ServiceState.starting;
		let interrupted = false;
		const attempt = deps.runtime.runPromise(
			deps.build().pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						interrupted = true;
					}),
				),
			),
		);
		building = attempt;
		attempt.then(
			() => {
				if (building === attempt && state.kind === "Starting")
					state = ServiceState.running;
			},
			(error: unknown) => {
				if (building === attempt) {
					building = null;
					if (state.kind === "Starting")
						state = ServiceState.failed(error);
				}
				// Unloading interrupted it; that is no failure to tell.
				if (!interrupted) deps.onBuildFailed(error);
			},
		);
		return attempt;
	};

	return {
		get,
		state: () => state,
		stop: Effect.suspend(() => {
			const last = building;
			const wasRunning = state.kind === "Running";
			building = null;
			state = ServiceState.stopped;
			if (!last) return Effect.void;
			if (wasRunning)
				return Effect.promise(() => last).pipe(
					Effect.flatMap(deps.close),
				);
			void last
				.then((store) => deps.runtime.runPromise(deps.close(store)))
				.catch(() => undefined);
			return Effect.void;
		}),
	};
}
