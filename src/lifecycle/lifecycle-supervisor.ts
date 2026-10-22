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
 * `stop` does not wait in the mailbox: it interrupts the command in flight,
 * drops those waiting, releases every service the launch owned (newest
 * first), stops the Librarian, and then the vault itself.
 */
import { Cause, Deferred, Effect, Exit, Fiber, Schema } from "effect";
import type { LibrarianStop } from "../commanders/librarian/librarian";
import { decrementPending, incrementPending } from "../utils/idle-tracker";
import type {
	LibrarianStartReason,
	LifecycleNotices,
} from "./lifecycle-notices";
import { ServiceState } from "./service-state";

/** A command reached the supervisor after the plugin began to unload. */
export class LifecycleStoppedError extends Schema.TaggedError<LifecycleStoppedError>()(
	"LifecycleStoppedError",
	{},
) {
	override get message(): string {
		return "the plugin has unloaded";
	}
}

/** The Librarian as the supervisor runs it. */
export type SupervisedLibrarian = {
	readonly init: () => Effect.Effect<void, unknown>;
	readonly unsubscribe: () => Effect.Effect<void, unknown>;
};

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
	readonly loadStore: () => Promise<unknown>;
	/** The unlink observer's sweep for links removed while the plugin was off. */
	readonly sweep: () => void;
	/** Once the Librarian's first start ended, run or failed: what needs it, such as the overlay. */
	readonly onLaunched: () => void;
};

export type LifecycleSupervisor<L extends SupervisedLibrarian> = {
	/** The plugin's own state: `Running` once its launch is done. */
	readonly state: () => ServiceState;
	/** The Librarian started last; null before the launch made one, and after unload. */
	readonly librarian: () => L | null;
	readonly librarianState: () => ServiceState<LibrarianPauseReason>;
	readonly classifyState: () => ServiceState<ClassifyPauseReason>;
	/** Why Classify may not run now, if it may not. */
	readonly classifyRefusal: () => string | undefined;

	/**
	 * Waits for Obsidian with `boot`, which builds the plugin's services and
	 * owns them, then starts the Librarian. A failure is logged.
	 */
	readonly launch: (
		boot: Effect.Effect<LaunchedPlugin<L>, unknown>,
	) => Effect.Effect<void>;
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
	) => Effect.Effect<void, unknown>;
	/**
	 * Starts the Librarian again, after `pause` or a failure, failing with
	 * what stopped its start. Its own stop notice is held back: the caller,
	 * a delimiter migration, reports it.
	 */
	readonly resume: Effect.Effect<void, unknown>;
	/**
	 * Runs a delimiter migration once every lifecycle command already
	 * submitted is done. Restart is refused until it ends.
	 */
	readonly duringMigration: <A, E>(
		task: Effect.Effect<A, E>,
	) => Effect.Effect<A, E | LifecycleStoppedError>;

	/**
	 * Releases `release` as the plugin unloads, before the Librarian stops.
	 * `what` names it in the log should it fail, such as `"close the
	 * dictionary store"`. Owned after unload began, it is released at once.
	 */
	readonly own: (what: string, release: Effect.Effect<void, unknown>) => void;
	/** Releases `release` last, after the Librarian stopped: the vault. */
	readonly ownLast: (
		what: string,
		release: Effect.Effect<void, unknown>,
	) => void;
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

type Command = {
	readonly kind: CommandKind;
	readonly body: Effect.Effect<unknown, unknown>;
	readonly done: Deferred.Deferred<unknown, unknown>;
};

type InFlight = {
	readonly command: Command;
	fiber: Fiber.Fiber<unknown, unknown> | null;
};

type Owned = {
	readonly what: string;
	readonly release: Effect.Effect<void, unknown>;
};

/** The Librarian started last, and how its stop is told. */
type LibrarianSlot<L> = {
	readonly librarian: L;
	/** Its start's reason until the start ended; `null` once it runs. */
	starting: LibrarianStartReason | null;
	detach: (() => void) | null;
};

export function createLifecycleSupervisor<L extends SupervisedLibrarian>(deps: {
	readonly notices: LifecycleNotices;
}): LifecycleSupervisor<L> {
	const { notices } = deps;

	let pluginState: ServiceState = ServiceState.idle;
	let launched: LaunchedPlugin<L> | null = null;
	let current: LibrarianSlot<L> | null = null;
	let librarianState: ServiceState<LibrarianPauseReason> = ServiceState.idle;
	let swept = false;
	let migrations = 0;
	let stopping = false;
	const stopped = Deferred.makeUnsafe<void>();
	const owned: Owned[] = [];
	const ownedLast: Owned[] = [];

	// ─── Mailbox ───

	const mailbox: Command[] = [];
	let inFlight: InFlight | null = null;

	const pump = (): void => {
		if (inFlight || stopping) return;
		const command = mailbox.shift();
		if (!command) return;
		const entry: InFlight = { command, fiber: null };
		inFlight = entry;
		const fiber = Effect.runFork(command.body);
		entry.fiber = fiber;
		fiber.addObserver((exit) => {
			if (inFlight === entry) inFlight = null;
			decrementPending();
			Deferred.doneUnsafe(
				command.done,
				stopping && Exit.hasInterrupts(exit)
					? Exit.fail(new LifecycleStoppedError())
					: exit,
			);
			pump();
		});
	};

	const submit = <A, E>(
		kind: CommandKind,
		body: Effect.Effect<A, E>,
	): Effect.Effect<A, E | LifecycleStoppedError> =>
		Effect.suspend(() => {
			if (stopping) return Effect.fail(new LifecycleStoppedError());
			const done = Deferred.makeUnsafe<A, E | LifecycleStoppedError>();
			mailbox.push({
				body,
				done: done as Deferred.Deferred<unknown, unknown>,
				kind,
			});
			incrementPending();
			pump();
			return Deferred.await(done);
		});

	const submitted = (kind: CommandKind): boolean =>
		inFlight?.command.kind === kind ||
		mailbox.some((command) => command.kind === kind);

	// ─── Librarian ───

	const detach = (): void => {
		const teardown = current?.detach;
		if (current) current.detach = null;
		teardown?.();
	};

	/** Unwires the Librarian and unsubscribes it, unless it is paused. */
	const stopCurrent = Effect.suspend(() => {
		detach();
		if (!current || librarianState.kind === "Paused") return Effect.void;
		return current.librarian.unsubscribe().pipe(
			Effect.catchDefect(Effect.fail),
			Effect.tapError((cause) =>
				Effect.sync(() => {
					librarianState = ServiceState.failed(cause);
				}),
			),
		);
	});

	/** The sweep, once the dictionary store has loaded. */
	const sweepOnce = (plugin: LaunchedPlugin<L>): void => {
		if (swept) return;
		swept = true;
		incrementPending();
		plugin
			.loadStore()
			.then(() => {
				if (!stopping) plugin.sweep();
			}, notices.sweepSkipped)
			.finally(decrementPending);
	};

	const startLibrarian = (
		plugin: LaunchedPlugin<L>,
		reason: LibrarianStartReason,
	): Effect.Effect<void, unknown> =>
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
				starting: reason,
			};
			slot = started;
			current = started;
			librarianState = ServiceState.starting;
			return librarian.init().pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						if (current !== started || stopping) return;
						started.detach = plugin.attachLibrarian(librarian);
						librarianState = ServiceState.running;
						sweepOnce(plugin);
					}),
				),
				// A start that throws failed like one that fails: the
				// command reports it, and the launch goes on.
				Effect.catchDefect(Effect.fail),
				Effect.tapError((cause) =>
					Effect.sync(() => {
						if (current === started)
							librarianState = ServiceState.failed(cause);
					}),
				),
				Effect.ensuring(
					Effect.sync(() => {
						started.starting = null;
					}),
				),
			);
		}).pipe(Effect.catchDefect(Effect.fail));

	const restartLibrarian = (reason: LibrarianStartReason) =>
		Effect.suspend(() => {
			const plugin = launched;
			if (!plugin)
				return Effect.fail(new Error("Textfresser has not launched"));
			return stopCurrent.pipe(
				Effect.andThen(startLibrarian(plugin, reason)),
			);
		});

	/** A command the unload dropped answers `fallback`. */
	const ignoreStopped =
		<B>(fallback: B) =>
		<A, E>(
			self: Effect.Effect<A, E>,
		): Effect.Effect<A | B, Exclude<E, LifecycleStoppedError>> =>
			self.pipe(
				Effect.catch((error) =>
					error instanceof LifecycleStoppedError
						? Effect.succeed(fallback)
						: Effect.fail(
								error as Exclude<E, LifecycleStoppedError>,
							),
				),
			);

	// ─── Release ───

	const release = (list: Owned[]) =>
		Effect.forEach(
			list.splice(0).reverse(),
			({ what, release: run }) =>
				run.pipe(
					Effect.catchCause((cause) =>
						Effect.sync(() =>
							notices.releaseFailed(what, Cause.squash(cause)),
						),
					),
				),
			{ discard: true },
		);

	const own =
		(list: Owned[]) =>
		(what: string, run: Effect.Effect<void, unknown>): void => {
			if (stopping) {
				Effect.runFork(release([{ release: run, what }]));
				return;
			}
			list.push({ release: run, what });
		};

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
					const plugin = yield* boot;
					launched = plugin;
					yield* startLibrarian(plugin, "Launch").pipe(
						Effect.catch((error) =>
							Effect.sync(() =>
								notices.librarianStartFailed("Launch", error),
							),
						),
					);
					plugin.onLaunched();
					pluginState = ServiceState.running;
				}).pipe(
					Effect.catchDefect(Effect.fail),
					Effect.catch((error) =>
						Effect.sync(() => {
							pluginState = ServiceState.failed(error);
							notices.launchFailed(error);
						}),
					),
				),
			).pipe(ignoreStopped(undefined)),
		librarian: () => (stopping ? null : (current?.librarian ?? null)),
		librarianState: () => librarianState,
		own: own(owned),
		ownLast: own(ownedLast),
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
				return Deferred.await(
					last.done as Deferred.Deferred<
						boolean,
						LifecycleStoppedError
					>,
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
						Effect.catch((error) =>
							Effect.sync(() => {
								notices.librarianStartFailed("Settings", error);
								return false;
							}),
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
					Effect.catch((error) =>
						Effect.sync(() =>
							notices.librarianStartFailed(
								"RestartCommand",
								error,
							),
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
			const interrupted = inFlight?.fiber ?? null;
			interrupted?.interruptUnsafe();
			for (const command of mailbox.splice(0)) {
				decrementPending();
				Deferred.doneUnsafe(
					command.done,
					Exit.fail(new LifecycleStoppedError()),
				);
			}
			detach();
			return Effect.gen(function* () {
				yield* release(owned);
				if (interrupted) yield* Fiber.await(interrupted);
				const last = current;
				current = null;
				if (last) {
					// Even a stop that throws leaves the vault to dispose.
					yield* last.librarian
						.unsubscribe()
						.pipe(
							Effect.catchCause((cause) =>
								Effect.sync(() =>
									notices.librarianStopFailed(
										Cause.squash(cause),
									),
								),
							),
						);
				}
				librarianState = ServiceState.stopped;
				yield* release(ownedLast);
			}).pipe(Effect.ensuring(Deferred.done(stopped, Exit.void)));
		}),
	};
}
