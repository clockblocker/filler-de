/**
 * The dictionary store over `Worter/` as a service of the plugin's scope:
 * its build starts as the service is made, and every use shares it. A
 * build that failed (a scan of `Worter/` that could not finish) is tried
 * again on the next use. Closing the scope interrupts a build still under
 * way and closes a built store; the service then answers no more.
 */
import type {
	DictionaryScanError,
	DumdictVaultStore,
} from "@textfresser/dictionary";
import {
	Cause,
	Context,
	Data,
	Deferred,
	Effect,
	Exit,
	Fiber,
	Option,
	Ref,
	type Scope,
	Semaphore,
	SubscriptionRef,
} from "effect";
import { ServiceState } from "./service-state";

/** The store was asked for after the plugin began to unload. */
export class DictionaryStoreClosed extends Data.TaggedError(
	"DictionaryStoreClosed",
) {
	override get message(): string {
		return "the plugin has unloaded";
	}
}

export type DictionaryStoreService<Store, BuildError> = {
	/** `Failed` holds the whole cause of the build that failed last. */
	readonly state: SubscriptionRef.SubscriptionRef<
		ServiceState<never, Cause.Cause<BuildError>>
	>;
	/** The store, once its build ended; fails with what failed that build. */
	readonly get: Effect.Effect<Store, BuildError | DictionaryStoreClosed>;
};

/** A build under way or done, and its fiber. */
type Build<Store, BuildError> = {
	readonly done: Deferred.Deferred<Store, BuildError>;
	readonly fiber: Fiber.Fiber<Store, BuildError>;
};

/**
 * Makes the service in the current scope and starts its first build. The
 * scope's close interrupts the build, then closes what it built.
 */
export const makeDictionaryStoreService = Effect.fnUntraced(function* <
	Store,
	BuildError,
>(deps: {
	readonly build: Effect.Effect<Store, BuildError>;
	readonly close: (store: Store) => Effect.Effect<void>;
	/**
	 * Logs a build that failed, in the build's fiber. A build the closing
	 * scope interrupted is no failure to tell.
	 */
	readonly onBuildFailed: (
		cause: Cause.Cause<BuildError>,
	) => Effect.Effect<void>;
}): Effect.fn.Return<
	DictionaryStoreService<Store, BuildError>,
	never,
	Scope.Scope
> {
	const state = yield* SubscriptionRef.make<
		ServiceState<never, Cause.Cause<BuildError>>
	>(ServiceState.idle);
	/** The latest build; none before the first, after one failed, and once closed. */
	const current = yield* Ref.make<Option.Option<Build<Store, BuildError>>>(
		Option.none(),
	);
	const closed = yield* Ref.make(false);
	/** Two first uses at once still start one build. */
	const lock = yield* Semaphore.make(1);
	const scope = yield* Effect.scope;

	const ended = (
		done: Deferred.Deferred<Store, BuildError>,
		exit: Exit.Exit<Store, BuildError>,
	) =>
		Effect.gen(function* () {
			if (Exit.isFailure(exit)) {
				// The next use builds again.
				yield* Ref.update(current, (build) =>
					Option.isSome(build) && build.value.done === done
						? Option.none()
						: build,
				);
				if (!Cause.hasInterruptsOnly(exit.cause))
					yield* deps.onBuildFailed(exit.cause);
			}
			yield* SubscriptionRef.update(state, (now) =>
				now.kind !== "Starting"
					? now
					: Exit.isSuccess(exit)
						? ServiceState.running
						: Cause.hasInterruptsOnly(exit.cause)
							? now
							: ServiceState.failed(exit.cause),
			);
			yield* Deferred.done(done, exit);
		});

	/** The build under way or done, starting one when there is none. */
	const building = lock.withPermit(
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Ref.get(closed)) return Option.none();
				const existing = yield* Ref.get(current);
				if (Option.isSome(existing)) return existing;
				const done = yield* Deferred.make<Store, BuildError>();
				yield* SubscriptionRef.set(state, ServiceState.starting);
				const fiber = yield* deps.build.pipe(
					Effect.onExit((exit) => ended(done, exit)),
					Effect.forkIn(scope),
				);
				const build: Build<Store, BuildError> = { done, fiber };
				yield* Ref.set(current, Option.some(build));
				return Option.some(build);
			}),
		),
	);

	// Under the lock: a first use cannot start a build the close misses.
	yield* Effect.addFinalizer(() =>
		lock.withPermit(
			Effect.gen(function* () {
				yield* Ref.set(closed, true);
				yield* SubscriptionRef.set(state, ServiceState.stopped);
				const last = yield* Ref.getAndSet(current, Option.none());
				if (Option.isNone(last)) return;
				const { done, fiber } = last.value;
				// A fiber interrupted before it ran never tells `done`.
				const exit = yield* Fiber.interrupt(fiber).pipe(
					Effect.andThen(Fiber.await(fiber)),
				);
				yield* Deferred.done(done, exit);
				if (Exit.isSuccess(exit)) yield* deps.close(exit.value);
			}),
		),
	);

	yield* building;

	return {
		get: building.pipe(
			Effect.flatMap(
				(
					build,
				): Effect.Effect<Store, BuildError | DictionaryStoreClosed> =>
					Option.isSome(build)
						? Deferred.await(build.value.done)
						: Effect.fail(new DictionaryStoreClosed()),
			),
		),
		state,
	};
});

/** The plugin's dictionary store over `Worter/`. */
export class DictionaryStore extends Context.Service<
	DictionaryStore,
	DictionaryStoreService<DumdictVaultStore, DictionaryScanError>
>()("textfresser/lifecycle/DictionaryStore") {}
