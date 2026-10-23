/**
 * Runs the plugin's lifecycle: its launch, the Librarian's restarts, pauses
 * and resumes, and its unload.
 *
 * Every lifecycle command goes through one mailbox and runs alone, in the
 * order it came: two re-inits can never each subscribe a Librarian, a
 * delimiter migration pauses the Librarian a restart in flight leaves, and
 * a settings change during startup restarts the Librarian once startup is
 * done. Commands must not submit commands themselves; they would wait for
 * their own turn.
 *
 * The Librarian is `Starting`, `Running`, `Paused("DelimiterMigration")`,
 * `Failed` (its start failed, or it stopped later) or `Stopped`. Classify is
 * `Paused("DictionaryReset")` while a reset runs. The unlink observer's
 * sweep runs once, when the Librarian first runs and the dictionary store
 * has loaded.
 *
 * Each command runs in a fiber of a scope the supervisor owns, with the
 * services, tracer, loggers and span of the fiber that submitted it, under
 * a `Lifecycle.<kind>` span: a "Restart Librarian" shows under its
 * `command.restart-librarian`, and the Librarian's start under it.
 *
 * The services the launch builds live in a scope the supervisor owns, and
 * each Librarian it starts in a child scope of its own, which a restart or
 * a pause closes. `stop` does not wait in the mailbox: it interrupts the
 * command in flight, drops those waiting, closes the services' scope (their
 * finalizers run newest first), waits for the command, and closes the
 * Librarian's scope. The plugin runtime runs `stop` as the `Lifecycle`
 * Layer's finalizer, before it shuts VAM down.
 *
 * What fails is typed (`lifecycle-errors.ts`), and each failure keeps its
 * whole cause: a Librarian start that failed and threw as it cleaned up
 * tells both.
 */
import {
	Cause,
	Context,
	Deferred,
	Effect,
	Exit,
	type Fiber,
	Layer,
	Option,
	Scope,
	type Tracer,
} from "effect";
import type {
	Librarian,
	LibrarianStop,
	LibrarianUnsubscribeFailure,
} from "../commanders/librarian/librarian";
import { catchWhole, failWhole } from "../utils/causes";
import { IdleTracker } from "../utils/idle-tracker";
import {
	BootFailed,
	LibrarianStartFailed,
	LifecycleStoppedError,
	ReleaseFailed,
	type TaggedFailure,
} from "./lifecycle-errors";
import type {
	LibrarianStartReason,
	LifecycleNotices,
} from "./lifecycle-notices";
import { ServiceState } from "./service-state";

export {
	BootFailed,
	LibrarianStartFailed,
	LifecycleStoppedError,
	ReleaseFailed,
	type TaggedFailure,
} from "./lifecycle-errors";

/** The Librarian as the supervisor runs it. */
export type SupervisedLibrarian = {
	/** Fails with why it stopped, which it told `onStopped` too. */
	readonly init: () => Effect.Effect<void, LibrarianStop>;
	readonly unsubscribe: () => Effect.Effect<
		void,
		LibrarianUnsubscribeFailure
	>;
};

/**
 * What a Failed Librarian failed with: it stopped, its start failed, or
 * unsubscribing it did.
 */
export type LibrarianFailure =
	| LibrarianStop
	| LibrarianStartFailed
	| ReleaseFailed;

export type LibrarianPauseReason = "DelimiterMigration";
export type ClassifyPauseReason = "DictionaryReset";

/** What the launch wired, for the supervisor to run. */
export type LaunchedPlugin<L extends SupervisedLibrarian> = {
	/** A new Librarian under the current settings, telling `onStopped` when it stops. */
	readonly makeLibrarian: (onStopped: (stop: LibrarianStop) => void) => L;
	/**
	 * Wires a Running Librarian into the plugin, such as its user event
	 * handlers; answers how to unwire it.
	 */
	readonly attachLibrarian: (librarian: L) => () => void;
	/** Whether a dictionary reset runs: Classify is paused meanwhile. */
	readonly resetRunning: () => boolean;
	/** Loads the dictionary store; the unlink sweep waits for it. */
	readonly loadStore: Effect.Effect<unknown, TaggedFailure>;
	/** The unlink observer's sweep for links removed while the plugin was off. */
	readonly sweep: Effect.Effect<void>;
	/**
	 * Once the Librarian's first start ended, run or failed: what needs it,
	 * such as the overlay, built in the services' scope.
	 */
	readonly onLaunched: () => Effect.Effect<void, never, Scope.Scope>;
};

export type LifecycleSupervisor<L extends SupervisedLibrarian> = {
	/** The plugin's own state: `Running` once its launch is done. */
	readonly state: () => ServiceState<never, Cause.Cause<BootFailed>>;
	/** The Librarian started last; null before the launch made one, and after unload. */
	readonly librarian: () => L | null;
	readonly librarianState: () => ServiceState<
		LibrarianPauseReason,
		LibrarianFailure
	>;
	readonly classifyState: () => ServiceState<ClassifyPauseReason>;
	/** Why Classify may not run now, if it may not. */
	readonly classifyRefusal: () => string | undefined;

	/**
	 * Waits for Obsidian with `boot`, which builds the plugin's services in
	 * the scope it is given, then starts the Librarian. A failure is
	 * logged. The services are released as the plugin unloads, newest
	 * first, before the Librarian stops.
	 */
	readonly launch: (
		boot: Effect.Effect<LaunchedPlugin<L>, TaggedFailure, Scope.Scope>,
	) => Effect.Effect<void>;
	/** Ends once the launch ended, launched or failed, or the plugin unloads. */
	readonly whenLaunched: Effect.Effect<void>;
	/**
	 * The "Restart Librarian" command: refused while one is under way or a
	 * delimiter migration runs, and told when it worked.
	 */
	readonly restart: Effect.Effect<void>;
	/**
	 * The settings changed: restarts the Librarian under the settings now in
	 * effect. Answers whether it started. Requests that wait together run as
	 * one restart.
	 */
	readonly reconfigure: Effect.Effect<boolean>;
	/** Stops the Librarian until `resume`; Restart is refused meanwhile. */
	readonly pause: (
		reason: LibrarianPauseReason,
	) => Effect.Effect<void, ReleaseFailed | LifecycleStoppedError>;
	/**
	 * Starts the Librarian again, after `pause` or a failure, failing with
	 * what stopped its start. Its own stop notice is held back: the caller,
	 * a delimiter migration, reports it.
	 */
	readonly resume: Effect.Effect<
		void,
		LibrarianStartFailed | ReleaseFailed | LifecycleStoppedError
	>;
	/**
	 * Runs a delimiter migration once every lifecycle command already
	 * submitted is done. Restart is refused until it ends.
	 */
	readonly duringMigration: <A, E>(
		task: Effect.Effect<A, E>,
	) => Effect.Effect<A, E | LifecycleStoppedError>;
	/** Unloads the plugin. What it can release at once, it releases synchronously. */
	readonly stop: Effect.Effect<void>;
};

type CommandKind =
	| "Launch"
	| "Pause"
	| "Reconfigure"
	| "Restart"
	| "Resume"
	| "Settle";

/** What a command's body fails with. */
type CommandFailure = LibrarianStartFailed | ReleaseFailed;

type Command = {
	readonly kind: CommandKind;
	readonly body: Effect.Effect<unknown, CommandFailure>;
	readonly done: Deferred.Deferred<
		unknown,
		CommandFailure | LifecycleStoppedError
	>;
	/** The submitter's services, tracer, loggers and span. */
	readonly context: Context.Context<never>;
	/** The spans of the requests that joined it while it waited. */
	readonly links: Tracer.SpanLink[];
};

type InFlight = {
	readonly command: Command;
	fiber: Fiber.Fiber<unknown, CommandFailure> | null;
	/** Whether its submitter has been answered. */
	settled: boolean;
};

/** The Librarian started last, the scope it lives in, and how its stop is told. */
type LibrarianSlot<L> = {
	readonly librarian: L;
	/** Closed by a restart, a pause or the unload: unwires and unsubscribes it. */
	readonly scope: Scope.Closeable;
	/** Its start's reason until the start ended; `null` once it runs. */
	starting: LibrarianStartReason | null;
	detach: (() => void) | null;
	/** How unsubscribing it ended, once its scope closed, until read. */
	unsubscribed: Exit.Exit<void, LibrarianUnsubscribeFailure> | null;
};

/**
 * Runs `release`, a part of the plugin being released, such as a Layer's
 * finalizer. What it fails or dies with is logged as a `ReleaseFailed`
 * named `what`, not raised: the releases after it still run.
 */
export const releaseGuarded = (
	notices: Pick<LifecycleNotices, "releaseFailed">,
	what: string,
	release: Effect.Effect<void, TaggedFailure>,
): Effect.Effect<void> =>
	release.pipe(
		// Even an interrupted release leaves the rest to release.
		Effect.catchCause((cause) =>
			notices.releaseFailed(new ReleaseFailed({ cause, what })),
		),
	);

export function createLifecycleSupervisor<L extends SupervisedLibrarian>(deps: {
	readonly notices: LifecycleNotices;
}): LifecycleSupervisor<L> {
	const { notices } = deps;

	let pluginState: ServiceState<
		never,
		Cause.Cause<BootFailed>
	> = ServiceState.idle;
	let launched: LaunchedPlugin<L> | null = null;
	let current: LibrarianSlot<L> | null = null;
	let librarianState: ServiceState<LibrarianPauseReason, LibrarianFailure> =
		ServiceState.idle;
	let swept = false;
	let migrations = 0;
	let stopping = false;
	const stopped = Deferred.makeUnsafe<void>();
	const launchEnded = Deferred.makeUnsafe<void>();
	/** Holds what the launch builds; `stop` closes it, newest first. */
	const services = Scope.makeUnsafe();

	// ─── Mailbox ───

	const mailbox: Command[] = [];
	let inFlight: InFlight | null = null;
	/** Holds the command fibers; `stop` closes it once they are interrupted. */
	const commands = Scope.makeUnsafe();

	/** Answers the command's submitter, once. */
	const settle = (
		entry: InFlight,
		exit: Exit.Exit<unknown, CommandFailure>,
	): void => {
		if (entry.settled) return;
		entry.settled = true;
		if (inFlight === entry) inFlight = null;
		Deferred.doneUnsafe(
			entry.command.done,
			stopping && Exit.hasInterrupts(exit)
				? Exit.fail(new LifecycleStoppedError())
				: exit,
		);
	};

	/**
	 * Starts the next command unless one runs. Its fiber starts the one
	 * after as it ends, whether it succeeded, failed or was interrupted.
	 */
	const pump: Effect.Effect<void> = Effect.suspend(() => {
		if (inFlight || stopping) return Effect.void;
		const command = mailbox.shift();
		if (!command) return Effect.void;
		const entry: InFlight = { command, fiber: null, settled: false };
		inFlight = entry;
		return command.body.pipe(
			Effect.withSpan(`Lifecycle.${command.kind}`, {
				links: command.links,
			}),
			Effect.provideContext(command.context),
			Effect.onExit((exit) =>
				Effect.suspend(() => {
					settle(entry, exit);
					return pump;
				}),
			),
			Effect.forkIn(commands),
			Effect.flatMap((fiber) =>
				Effect.sync(() => {
					entry.fiber = fiber;
					// A fiber interrupted before it started never ran `onExit`.
					fiber.addObserver((exit) => settle(entry, exit));
				}),
			),
		);
	});

	/** Queues `body`; its submitter counts as pending work until answered. */
	const submit = <A, E extends CommandFailure>(
		kind: CommandKind,
		body: Effect.Effect<A, E>,
	): Effect.Effect<A, E | LifecycleStoppedError> =>
		Effect.gen(function* () {
			if (stopping) return yield* new LifecycleStoppedError();
			const idle = yield* IdleTracker;
			const done = Deferred.makeUnsafe<A, E | LifecycleStoppedError>();
			mailbox.push({
				body,
				context: yield* Effect.context<never>(),
				// The body fails only with `E`, so `done` is told only that.
				done: done as Deferred.Deferred<
					unknown,
					CommandFailure | LifecycleStoppedError
				>,
				kind,
				links: [],
			});
			return yield* idle.track(
				pump.pipe(Effect.andThen(Deferred.await(done))),
			);
		});

	const submitted = (kind: CommandKind): boolean =>
		inFlight?.command.kind === kind ||
		mailbox.some((command) => command.kind === kind);

	// ─── Librarian ───

	/** Unwires the Librarian now, such as before the services stop. */
	const detach = (slot: LibrarianSlot<L> | null = current): void => {
		const teardown = slot?.detach;
		if (slot) slot.detach = null;
		teardown?.();
	};

	const guarded = (
		what: string,
		release: Effect.Effect<void, TaggedFailure>,
	) => releaseGuarded(notices, what, release);

	/**
	 * Closes the Librarian's scope, which unwires and unsubscribes it, and
	 * answers how unsubscribing it failed, if it did. A scope closed before,
	 * as a pause closes it, answers nothing.
	 */
	const closeLibrarian = (
		slot: LibrarianSlot<L>,
	): Effect.Effect<Cause.Cause<LibrarianUnsubscribeFailure> | null> =>
		Scope.close(slot.scope, Exit.void).pipe(
			Effect.map(() => {
				const exit = slot.unsubscribed;
				slot.unsubscribed = null;
				return exit &&
					Exit.isFailure(exit) &&
					!Cause.hasInterruptsOnly(exit.cause)
					? exit.cause
					: null;
			}),
		);

	/** Unwires the Librarian and unsubscribes it, unless it is paused. */
	const stopCurrent: Effect.Effect<void, ReleaseFailed> = Effect.suspend(
		() => {
			const slot = current;
			if (!slot) return Effect.void;
			return closeLibrarian(slot).pipe(
				Effect.flatMap((cause) => {
					if (!cause) return Effect.void;
					const failure = new ReleaseFailed({
						cause,
						what: "unsubscribe the Librarian",
					});
					librarianState = ServiceState.failed(failure);
					return Effect.fail(failure);
				}),
			);
		},
	);

	/**
	 * The sweep, once the dictionary store has loaded. It waits for the
	 * store on a fiber of its own, so the start it follows does not.
	 */
	const sweepOnce = (plugin: LaunchedPlugin<L>): Effect.Effect<void> =>
		Effect.suspend(() => {
			if (swept) return Effect.void;
			swept = true;
			return Effect.gen(function* () {
				const idle = yield* IdleTracker;
				// Pending from now, not from when its fiber first runs.
				yield* idle.start;
				return yield* plugin.loadStore.pipe(
					Effect.matchCauseEffect({
						onFailure: (cause) =>
							Cause.hasInterruptsOnly(cause)
								? Effect.void
								: notices.sweepSkipped(cause),
						onSuccess: () =>
							Effect.suspend(() =>
								stopping ? Effect.void : plugin.sweep,
							),
					}),
					// Its fiber is detached: nothing else would tell this.
					Effect.catchCause((cause) =>
						Effect.logError(
							"[TextEaterPlugin] The unlink sweep failed:",
							cause,
						),
					),
					Effect.ensuring(idle.end),
					Effect.forkDetach,
					Effect.asVoid,
				);
			});
		});

	/**
	 * Starts a new Librarian, in a scope of its own. A start that throws
	 * failed like one that fails: the command reports it, and the launch
	 * goes on.
	 */
	const startLibrarian = (
		plugin: LaunchedPlugin<L>,
		reason: LibrarianStartReason,
	): Effect.Effect<void, LibrarianStartFailed> =>
		Effect.suspend(() => {
			let slot: LibrarianSlot<L> | null = null;
			const librarian = plugin.makeLibrarian((stop) => {
				if (stopping || !slot) return;
				if (current === slot && librarianState.kind === "Running")
					librarianState = ServiceState.failed(stop);
				notices.librarianStopped(stop, slot.starting);
			});
			const started: LibrarianSlot<L> = {
				detach: null,
				librarian,
				scope: Scope.makeUnsafe(),
				starting: reason,
				unsubscribed: null,
			};
			slot = started;
			current = started;
			librarianState = ServiceState.starting;
			// Its scope closes newest first: unwired, then unsubscribed.
			return Scope.addFinalizer(
				started.scope,
				Effect.suspend(() => librarian.unsubscribe()).pipe(
					Effect.exit,
					Effect.flatMap((exit) =>
						Effect.sync(() => {
							started.unsubscribed = exit;
						}),
					),
				),
			).pipe(
				Effect.andThen(
					Scope.addFinalizer(
						started.scope,
						guarded(
							"unwire the Librarian",
							Effect.sync(() => detach(started)),
						),
					),
				),
				Effect.andThen(librarian.init()),
				Effect.tap(() =>
					Effect.suspend(() => {
						if (current !== started || stopping) return Effect.void;
						started.detach = plugin.attachLibrarian(librarian);
						librarianState = ServiceState.running;
						return sweepOnce(plugin);
					}),
				),
				failWhole(
					(cause) => new LibrarianStartFailed({ cause, reason }),
				),
				Effect.tapError((failure) =>
					Effect.sync(() => {
						if (current === started)
							librarianState = ServiceState.failed(failure);
					}),
				),
				Effect.ensuring(
					Effect.sync(() => {
						started.starting = null;
					}),
				),
			);
		}).pipe(
			// `makeLibrarian` threw.
			Effect.catchDefect((defect) =>
				Effect.fail(
					new LibrarianStartFailed({
						cause: Cause.die(defect),
						reason,
					}),
				),
			),
		);

	const restartLibrarian = (
		reason: LibrarianStartReason,
	): Effect.Effect<void, LibrarianStartFailed | ReleaseFailed> =>
		Effect.suspend(() => {
			const plugin = launched;
			if (!plugin)
				// Every caller checks the launch first.
				return Effect.fail(
					new LibrarianStartFailed({
						cause: Cause.die(
							new Error("Textfresser has not launched"),
						),
						reason,
					}),
				);
			return stopCurrent.pipe(
				Effect.andThen(startLibrarian(plugin, reason)),
			);
		});

	/** A command the unload dropped answers `fallback`. */
	const ignoreStopped =
		<B>(fallback: B) =>
		<A>(
			self: Effect.Effect<A, LifecycleStoppedError>,
		): Effect.Effect<A | B> =>
			self.pipe(
				Effect.catchTag("LifecycleStoppedError", () =>
					Effect.succeed(fallback),
				),
			);

	// ─── Commands ───

	return {
		classifyRefusal: () =>
			!stopping && launched?.resetRunning()
				? "A dictionary reset is running; Classify once it has ended."
				: undefined,
		classifyState: () => {
			if (stopping) return ServiceState.stopped;
			if (!launched) return ServiceState.idle;
			return launched.resetRunning()
				? ServiceState.paused("DictionaryReset")
				: ServiceState.running;
		},
		duringMigration: (task) =>
			Effect.suspend(() => {
				migrations++;
				return submit("Settle", Effect.void).pipe(
					Effect.andThen(task),
					Effect.ensuring(
						Effect.sync(() => {
							migrations--;
						}),
					),
				);
			}),
		launch: (boot) =>
			submit(
				"Launch",
				Effect.gen(function* () {
					pluginState = ServiceState.starting;
					const plugin = yield* boot.pipe(
						Scope.provide(services),
						failWhole((cause) => new BootFailed({ cause })),
					);
					launched = plugin;
					yield* startLibrarian(plugin, "Launch").pipe(
						Effect.catchTag("LibrarianStartFailed", (failure) =>
							notices.librarianStartFailed("Launch", failure),
						),
					);
					yield* plugin.onLaunched().pipe(Scope.provide(services));
					pluginState = ServiceState.running;
				}).pipe(
					// A boot that failed, or a launch that threw: every reason.
					catchWhole((cause) =>
						Effect.suspend(() => {
							pluginState = ServiceState.failed(cause);
							return notices.launchFailed(cause);
						}),
					),
					Effect.ensuring(Deferred.done(launchEnded, Exit.void)),
				),
			).pipe(ignoreStopped(undefined)),
		librarian: () => (stopping ? null : (current?.librarian ?? null)),
		librarianState: () => librarianState,
		pause: (reason) =>
			submit(
				"Pause",
				stopCurrent.pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							librarianState = ServiceState.paused(reason);
						}),
					),
				),
			),
		reconfigure: Effect.suspend(() => {
			const last = mailbox.at(-1);
			if (last?.kind === "Reconfigure")
				// It runs once for both: its span links to this request's.
				return Effect.currentSpan.pipe(
					Effect.option,
					Effect.flatMap((span) => {
						if (Option.isSome(span))
							last.links.push({
								attributes: {},
								span: span.value,
							});
						return Deferred.await(
							last.done as Deferred.Deferred<
								boolean,
								LifecycleStoppedError
							>,
						);
					}),
				);
			return submit(
				"Reconfigure",
				Effect.suspend(() => {
					if (!launched) return Effect.succeed(false);
					// A paused Librarian starts under the settings in effect
					// when its migration resumes it.
					if (librarianState.kind === "Paused")
						return Effect.succeed(false);
					return restartLibrarian("Settings").pipe(
						Effect.as(true),
						Effect.catchTag(
							["LibrarianStartFailed", "ReleaseFailed"],
							(failure) =>
								notices
									.librarianStartFailed("Settings", failure)
									.pipe(Effect.as(false)),
						),
					);
				}),
			);
		}).pipe(ignoreStopped(false)),
		restart: Effect.suspend(() => {
			if (stopping) return Effect.void;
			if (!launched) {
				notices.stillLoading();
				return Effect.void;
			}
			if (submitted("Restart")) {
				notices.alreadyRestarting();
				return Effect.void;
			}
			if (migrations > 0) {
				notices.restartWaitsForMigration();
				return Effect.void;
			}
			return submit(
				"Restart",
				restartLibrarian("RestartCommand").pipe(
					Effect.tap(() => Effect.sync(notices.librarianRestarted)),
					Effect.catchTag(
						["LibrarianStartFailed", "ReleaseFailed"],
						(failure) =>
							notices.librarianStartFailed(
								"RestartCommand",
								failure,
							),
					),
				),
			);
		}).pipe(ignoreStopped(undefined)),
		resume: submit("Resume", restartLibrarian("DelimiterMigration")),
		state: () => pluginState,
		stop: Effect.suspend(() => {
			if (stopping) return Deferred.await(stopped);
			stopping = true;
			pluginState = ServiceState.stopped;
			notices.close();
			// Interrupted now; waited for once the services are released.
			inFlight?.fiber?.interruptUnsafe();
			for (const command of mailbox.splice(0))
				Deferred.doneUnsafe(
					command.done,
					Exit.fail(new LifecycleStoppedError()),
				);
			Deferred.doneUnsafe(launchEnded, Exit.void);
			return Effect.gen(function* () {
				// Unwiring that throws still leaves the rest to release.
				yield* guarded(
					"unwire the Librarian",
					Effect.sync(() => detach()),
				);
				// Every service's finalizer runs, newest first, even after
				// one failed; each logs its own failure.
				yield* guarded(
					"release the plugin's services",
					Scope.close(services, Exit.void),
				);
				// Waits for the command in flight to end, and interrupts any
				// command fiber still starting.
				yield* Scope.close(commands, Exit.void);
				const last = current;
				current = null;
				if (last) {
					// Even a stop that throws leaves the rest to release.
					const failed = yield* closeLibrarian(last);
					if (failed) yield* notices.librarianStopFailed(failed);
				}
				librarianState = ServiceState.stopped;
			}).pipe(Effect.ensuring(Deferred.done(stopped, Exit.void)));
		}),
		whenLaunched: Deferred.await(launchEnded),
	};
}

/**
 * The plugin's lifecycle, as a service of the plugin runtime. `layer`
 * makes it; `stopsOnRelease`, built above every service the lifecycle's
 * commands use (dumgen among them), gives it its finalizer, `stop`, so
 * disposing the runtime releases the services (newest first) and the
 * Librarian before those, and VAM, shut down.
 */
export class Lifecycle extends Context.Service<
	Lifecycle,
	LifecycleSupervisor<Librarian>
>()("textfresser/lifecycle/Lifecycle") {
	static readonly layer = (deps: { readonly notices: LifecycleNotices }) =>
		Layer.sync(Lifecycle, () => createLifecycleSupervisor<Librarian>(deps));

	static readonly stopsOnRelease = Layer.effectDiscard(
		Effect.gen(function* () {
			const lifecycle = yield* Lifecycle;
			yield* Effect.addFinalizer(() => lifecycle.stop);
		}),
	);
}
