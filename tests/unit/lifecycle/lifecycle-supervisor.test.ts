import { describe, expect, it } from "bun:test";
import { Deferred, Effect } from "effect";
import type { LibrarianStop } from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type LaunchedPlugin,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";

/** A Librarian whose start the test ends, with `start` or `fail`. */
type FakeLibrarian = SupervisedLibrarian & {
	readonly id: number;
	subscribed: boolean;
	interrupted: boolean;
	readonly start: () => void;
	readonly fail: (stop: LibrarianStop) => void;
	/** Tells the supervisor this Librarian stopped later, while it ran. */
	readonly stopLater: (stop: LibrarianStop) => void;
};

const STOPPED: LibrarianStop = {
	kind: "Stopped",
	message: "The Librarian stopped: it could not heal the library.",
};
const ROOT_MISSING: LibrarianStop = {
	kind: "LibraryRootMissing",
	message: "The Librarian is off: there is no Library folder.",
};

/** Lets every fiber and promise that can move, move. */
const settle = async () => {
	for (let round = 0; round < 5; round++)
		await new Promise((resolve) => setTimeout(resolve, 0));
};

function makeHarness(options: { readonly autoStart?: boolean } = {}) {
	const shown: { message: string; sticky: boolean }[] = [];
	const events: string[] = [];
	const librarians: FakeLibrarian[] = [];
	let resetRunning = false;
	let storeLoaded: Deferred.Deferred<void, unknown> = Deferred.makeUnsafe();
	Deferred.doneUnsafe(storeLoaded, Effect.void);

	const notices = createLifecycleNotices((message, { sticky }) => {
		shown.push({ message, sticky });
	});
	const supervisor = createLifecycleSupervisor<FakeLibrarian>({ notices });

	const makeLibrarian = (
		onStopped: (stop: LibrarianStop) => void,
	): FakeLibrarian => {
		const id = librarians.length;
		const gate = Deferred.makeUnsafe<void, LibrarianStop>();
		const librarian: FakeLibrarian = {
			fail: (stop) => {
				onStopped(stop);
				Deferred.doneUnsafe(gate, Effect.fail(stop));
			},
			id,
			init: () =>
				Effect.gen(function* () {
					events.push(`init ${id}`);
					librarian.subscribed = true;
					if (!options.autoStart) yield* Deferred.await(gate);
					events.push(`running ${id}`);
				}).pipe(
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							librarian.interrupted = true;
						}),
					),
					Effect.onError(() =>
						Effect.sync(() => {
							librarian.subscribed = false;
						}),
					),
				),
			interrupted: false,
			start: () => Deferred.doneUnsafe(gate, Effect.void),
			stopLater: onStopped,
			subscribed: false,
			unsubscribe: () =>
				Effect.sync(() => {
					events.push(`unsubscribe ${id}`);
					librarian.subscribed = false;
				}),
		};
		librarians.push(librarian);
		return librarian;
	};

	const plugin: LaunchedPlugin<FakeLibrarian> = {
		attachLibrarian: (librarian) => {
			events.push(`attach ${librarian.id}`);
			return () => events.push(`detach ${librarian.id}`);
		},
		loadStore: () => Effect.runPromise(Deferred.await(storeLoaded)),
		makeLibrarian,
		onLaunched: () => events.push("launched"),
		resetRunning: () => resetRunning,
		sweep: () => events.push("sweep"),
	};

	return {
		events,
		/** The store loads only once the test lets it. */
		holdStore: () => {
			storeLoaded = Deferred.makeUnsafe();
			return storeLoaded;
		},
		/** Launches with `boot`, by default one that wires `plugin` at once. */
		launch: (boot: Effect.Effect<LaunchedPlugin<FakeLibrarian>, unknown> = Effect.succeed(plugin)) =>
			Effect.runPromise(supervisor.launch(boot)),
		librarians,
		plugin,
		setResetRunning: (running: boolean) => {
			resetRunning = running;
		},
		shown,
		/** The Librarians still subscribed to the vault. */
		subscribed: () =>
			librarians.filter(({ subscribed }) => subscribed).map(({ id }) => id),
		supervisor,
	};
}

describe("lifecycle supervisor: launch", () => {
	it("starts the Librarian, wires it, then the rest of the plugin", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		expect(h.supervisor.librarianState().kind).toBe("Starting");
		expect(h.supervisor.state().kind).toBe("Starting");

		h.librarians[0]?.start();
		await launch;
		await settle();

		expect(h.supervisor.librarianState().kind).toBe("Running");
		expect(h.supervisor.state().kind).toBe("Running");
		expect(h.events).toEqual([
			"init 0",
			"running 0",
			"attach 0",
			"launched",
			"sweep",
		]);
	});

	it("shows a sticky notice when the Librarian stops at launch, and launches the rest anyway", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.fail(STOPPED);
		await launch;

		expect(h.supervisor.librarianState().kind).toBe("Failed");
		expect(h.supervisor.state().kind).toBe("Running");
		expect(h.shown).toEqual([{ message: STOPPED.message, sticky: true }]);
		expect(h.events).toContain("launched");
	});

	it("only logs a missing Library folder at launch, but tells it on a re-init", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.fail(ROOT_MISSING);
		await launch;
		expect(h.shown).toEqual([]);

		const reconfigured = Effect.runPromise(h.supervisor.reconfigure);
		await settle();
		h.librarians[1]?.fail(ROOT_MISSING);
		expect(await reconfigured).toBe(false);
		expect(h.shown).toEqual([{ message: ROOT_MISSING.message, sticky: false }]);
	});

	it("shows a sticky notice when a running Librarian stops later", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch();
		h.librarians[0]?.stopLater(STOPPED);

		expect(h.supervisor.librarianState()).toEqual({
			cause: STOPPED,
			kind: "Failed",
		});
		expect(h.shown).toEqual([{ message: STOPPED.message, sticky: true }]);
	});
});

describe("lifecycle supervisor: Restart Librarian", () => {
	it("is refused while Textfresser still loads", async () => {
		const h = makeHarness();
		const boot = Deferred.makeUnsafe<LaunchedPlugin<FakeLibrarian>>();
		void h.launch(Deferred.await(boot));
		await settle();

		await Effect.runPromise(h.supervisor.restart);
		expect(h.shown.map(({ message }) => message)).toEqual([
			"Textfresser is still loading",
		]);
		expect(h.librarians).toHaveLength(0);
	});

	it("refuses a second restart while the first runs, and leaves one Librarian subscribed", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.start();
		await launch;

		const first = Effect.runPromise(h.supervisor.restart);
		await settle();
		const second = Effect.runPromise(h.supervisor.restart);
		await second;
		expect(h.shown.map(({ message }) => message)).toEqual([
			"The Librarian is already restarting",
		]);

		h.librarians[1]?.start();
		await first;
		expect(h.librarians).toHaveLength(2);
		expect(h.subscribed()).toEqual([1]);
		expect(h.shown.map(({ message }) => message)).toEqual([
			"The Librarian is already restarting",
			"Librarian restarted",
		]);
		expect(h.events.filter((event) => event !== "sweep").slice(4)).toEqual([
			"detach 0",
			"unsubscribe 0",
			"init 1",
			"running 1",
			"attach 1",
		]);
		expect(h.events.filter((event) => event === "sweep")).toHaveLength(1);
	});

	it("queues a restart asked for during the launch behind it", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();

		const restart = Effect.runPromise(h.supervisor.restart);
		await settle();
		expect(h.librarians).toHaveLength(1);

		h.librarians[0]?.start();
		await launch;
		await settle();
		h.librarians[1]?.start();
		await restart;

		expect(h.subscribed()).toEqual([1]);
		expect(h.shown.map(({ message }) => message)).toEqual([
			"Librarian restarted",
		]);
	});

	it("is refused while a delimiter migration runs", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch();

		const proceed = Deferred.makeUnsafe<void>();
		const migration = Effect.runPromise(
			h.supervisor.duringMigration(Deferred.await(proceed)),
		);
		await settle();
		await Effect.runPromise(h.supervisor.restart);
		expect(h.shown.map(({ message }) => message)).toEqual([
			"The suffix delimiter is still changing; the Librarian restarts once it is done",
		]);
		expect(h.librarians).toHaveLength(1);

		Deferred.doneUnsafe(proceed, Effect.void);
		await migration;
		await Effect.runPromise(h.supervisor.restart);
		expect(h.shown.at(-1)?.message).toBe("Librarian restarted");
	});
});

describe("lifecycle supervisor: delimiter migration", () => {
	it("waits for a restart in flight, then pauses the Librarian that restart left", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.start();
		await launch;

		const restart = Effect.runPromise(h.supervisor.restart);
		await settle();
		const steps: string[] = [];
		const migration = Effect.runPromise(
			h.supervisor.duringMigration(
				Effect.gen(function* () {
					steps.push("plan");
					yield* h.supervisor.pause("DelimiterMigration");
					steps.push(`paused, subscribed: ${h.subscribed().join(",")}`);
					yield* h.supervisor.resume;
				}),
			),
		);
		await settle();
		expect(steps).toEqual([]);

		h.librarians[1]?.start();
		await restart;
		await settle();
		expect(steps).toEqual(["plan", "paused, subscribed: "]);
		expect(h.supervisor.librarianState().kind).toBe("Starting");

		h.librarians[2]?.start();
		await migration;
		expect(h.subscribed()).toEqual([2]);
		expect(h.supervisor.librarianState().kind).toBe("Running");
		// The paused Librarian is not unsubscribed again on resume.
		expect(h.events.filter((event) => event === "unsubscribe 1")).toHaveLength(1);
	});

	it("holds back the Librarian's own notice on resume, and fails with what stopped it", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.start();
		await launch;
		await Effect.runPromise(h.supervisor.pause("DelimiterMigration"));
		expect(h.supervisor.librarianState()).toEqual({
			kind: "Paused",
			reason: "DelimiterMigration",
		});
		expect(h.subscribed()).toEqual([]);

		const resume = Effect.runPromise(Effect.flip(h.supervisor.resume));
		await settle();
		h.librarians[1]?.fail(STOPPED);
		expect(await resume).toBe(STOPPED);
		expect(h.shown).toEqual([]);

		// Once that start ended, a later stop is told again.
		const retry = Effect.runPromise(h.supervisor.resume);
		await settle();
		h.librarians[2]?.start();
		await retry;
		h.librarians[2]?.stopLater(STOPPED);
		expect(h.shown).toEqual([{ message: STOPPED.message, sticky: true }]);
	});

	it("leaves a paused Librarian to its migration when the settings change meanwhile", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch();
		await Effect.runPromise(h.supervisor.pause("DelimiterMigration"));

		expect(await Effect.runPromise(h.supervisor.reconfigure)).toBe(false);
		expect(h.librarians).toHaveLength(1);
		expect(h.subscribed()).toEqual([]);

		await Effect.runPromise(h.supervisor.resume);
		expect(h.subscribed()).toEqual([1]);
	});
});

describe("lifecycle supervisor: settings changes", () => {
	it("restarts the Librarian once the launch is done when the settings change during startup", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();

		const first = Effect.runPromise(h.supervisor.reconfigure);
		const second = Effect.runPromise(h.supervisor.reconfigure);
		await settle();
		expect(h.librarians).toHaveLength(1);

		h.librarians[0]?.start();
		await launch;
		await settle();
		// The two changes waited together and run as one restart.
		expect(h.librarians).toHaveLength(2);
		h.librarians[1]?.start();
		expect(await first).toBe(true);
		expect(await second).toBe(true);

		expect(h.subscribed()).toEqual([1]);
		// The sweep waits for the store on its own, so it may fall anywhere after launch.
		expect(h.events.filter((event) => event === "sweep")).toHaveLength(1);
		expect(h.events.filter((event) => event !== "sweep")).toEqual([
			"init 0",
			"running 0",
			"attach 0",
			"launched",
			"detach 0",
			"unsubscribe 0",
			"init 1",
			"running 1",
			"attach 1",
		]);
	});

	it("runs overlapping re-inits one after another", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch();
		const restart = Effect.runPromise(h.supervisor.restart);
		const reconfigure = Effect.runPromise(h.supervisor.reconfigure);
		await Promise.all([restart, reconfigure]);

		expect(h.librarians).toHaveLength(3);
		expect(h.subscribed()).toEqual([2]);
		const order = h.events.filter(
			(event) => event.startsWith("init") || event.startsWith("unsubscribe"),
		);
		expect(order).toEqual([
			"init 0",
			"unsubscribe 0",
			"init 1",
			"unsubscribe 1",
			"init 2",
		]);
	});
});

describe("lifecycle supervisor: ordering", () => {
	it("sweeps only once the Librarian runs and the dictionary store has loaded", async () => {
		const h = makeHarness();
		const store = h.holdStore();
		const launch = h.launch();
		await settle();
		expect(h.events).not.toContain("sweep");

		h.librarians[0]?.start();
		await launch;
		await settle();
		expect(h.events).not.toContain("sweep");

		Deferred.doneUnsafe(store, Effect.void);
		await settle();
		expect(h.events.at(-1)).toBe("sweep");
	});

	it("does not sweep after a failed start, but on the first start that runs", async () => {
		const h = makeHarness();
		const launch = h.launch();
		await settle();
		h.librarians[0]?.fail(STOPPED);
		await launch;
		await settle();
		expect(h.events).not.toContain("sweep");

		const restart = Effect.runPromise(h.supervisor.restart);
		await settle();
		h.librarians[1]?.start();
		await restart;
		await settle();
		expect(h.events.filter((event) => event === "sweep")).toHaveLength(1);

		const again = Effect.runPromise(h.supervisor.restart);
		await settle();
		h.librarians[2]?.start();
		await again;
		await settle();
		expect(h.events.filter((event) => event === "sweep")).toHaveLength(1);
	});

	it("pauses Classify while a dictionary reset runs", async () => {
		const h = makeHarness({ autoStart: true });
		expect(h.supervisor.classifyState().kind).toBe("Idle");
		await h.launch();
		expect(h.supervisor.classifyState().kind).toBe("Running");
		expect(h.supervisor.classifyRefusal()).toBeUndefined();

		h.setResetRunning(true);
		expect(h.supervisor.classifyState()).toEqual({
			kind: "Paused",
			reason: "DictionaryReset",
		});
		expect(h.supervisor.classifyRefusal()).toBe(
			"A dictionary reset is running; Classify once it has ended.",
		);
	});
});

describe("lifecycle supervisor: unload", () => {
	it("interrupts a startup in flight, tells nothing, and releases newest first, the vault last", async () => {
		const h = makeHarness();
		const released: string[] = [];
		const boot = Effect.sync(() => {
			h.supervisor.ownLast(
				"dispose the vault",
				Effect.sync(() => released.push("vault")),
			);
			h.supervisor.own(
				"close the store",
				Effect.sync(() => released.push("store")),
			);
			h.supervisor.own(
				"close the observer",
				Effect.sync(() => released.push("observer")),
			);
			return h.plugin;
		});
		const launch = h.launch(boot);
		const queued = Effect.runPromise(h.supervisor.reconfigure);
		await settle();
		const librarian = h.librarians[0];
		expect(librarian?.subscribed).toBe(true);

		await Effect.runPromise(h.supervisor.stop);
		await launch;

		expect(librarian?.interrupted).toBe(true);
		expect(h.subscribed()).toEqual([]);
		expect(h.shown).toEqual([]);
		expect(await queued).toBe(false);
		expect(h.librarians).toHaveLength(1);
		expect(h.events).not.toContain("launched");
		expect(released).toEqual(["observer", "store", "vault"]);
		expect(h.events.slice(-1)).toEqual(["unsubscribe 0"]);
		expect(h.supervisor.state().kind).toBe("Stopped");
		expect(h.supervisor.librarianState().kind).toBe("Stopped");
		expect(h.supervisor.librarian()).toBeNull();
	});

	it("interrupts a launch still waiting for Obsidian", async () => {
		const h = makeHarness();
		const ready = Deferred.makeUnsafe<LaunchedPlugin<FakeLibrarian>>();
		const launch = h.launch(Deferred.await(ready));
		await settle();
		await Effect.runPromise(h.supervisor.stop);
		await launch;
		expect(h.librarians).toHaveLength(0);
		expect(h.supervisor.state().kind).toBe("Stopped");
	});

	it("unwires and unsubscribes a running Librarian, and takes no more commands", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch();
		await Effect.runPromise(h.supervisor.stop);

		expect(h.events.slice(-2)).toEqual(["detach 0", "unsubscribe 0"]);
		await Effect.runPromise(h.supervisor.restart);
		expect(await Effect.runPromise(h.supervisor.reconfigure)).toBe(false);
		const late = await Effect.runPromise(
			Effect.flip(h.supervisor.pause("DelimiterMigration")),
		);
		expect((late as { _tag?: string })._tag).toBe("LifecycleStoppedError");
		expect(h.librarians).toHaveLength(1);

		let released = false;
		h.supervisor.own(
			"late",
			Effect.sync(() => {
				released = true;
			}),
		);
		await settle();
		expect(released).toBe(true);
	});

	it("keeps releasing when one release fails", async () => {
		const h = makeHarness({ autoStart: true });
		const released: string[] = [];
		await h.launch(
			Effect.sync(() => {
				h.supervisor.own(
					"first",
					Effect.sync(() => released.push("first")),
				);
				h.supervisor.own(
					"broken",
					Effect.sync(() => {
						throw new Error("boom");
					}),
				);
				return h.plugin;
			}),
		);
		await Effect.runPromise(h.supervisor.stop);
		expect(released).toEqual(["first"]);
	});
});

describe("lifecycle supervisor: thrown errors", () => {
	/** `h.plugin`, but the first Librarian's `init` or `unsubscribe` throws. */
	const throwingFirst = (
		h: ReturnType<typeof makeHarness>,
		method: "init" | "unsubscribe",
	): LaunchedPlugin<FakeLibrarian> => ({
		...h.plugin,
		makeLibrarian: (onStopped) => {
			const librarian = h.plugin.makeLibrarian(onStopped);
			if (librarian.id !== 0) return librarian;
			return Object.assign(librarian, {
				[method]: () => Effect.die(new Error("boom")),
			});
		},
	});

	it("takes a Librarian start that throws for a failed start: the launch goes on, and so do later commands", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch(Effect.succeed(throwingFirst(h, "init")));

		expect(h.supervisor.librarianState().kind).toBe("Failed");
		expect(h.supervisor.state().kind).toBe("Running");
		expect(h.events).toContain("launched");
		expect(await Effect.runPromise(h.supervisor.reconfigure)).toBe(true);
		expect(h.supervisor.librarianState().kind).toBe("Running");
	});

	it("logs a launch that throws, and answers the commands after it", async () => {
		const h = makeHarness({ autoStart: true });
		await h.launch(Effect.die(new Error("boom")));

		expect(h.supervisor.state().kind).toBe("Failed");
		expect(await Effect.runPromise(h.supervisor.reconfigure)).toBe(false);
	});

	it("still disposes the vault when the Librarian's stop throws", async () => {
		const h = makeHarness({ autoStart: true });
		let disposed = false;
		await h.launch(
			Effect.sync(() => {
				h.supervisor.ownLast(
					"dispose the vault",
					Effect.sync(() => {
						disposed = true;
					}),
				);
				return throwingFirst(h, "unsubscribe");
			}),
		);
		await Effect.runPromise(h.supervisor.stop);
		expect(disposed).toBe(true);
	});
});
