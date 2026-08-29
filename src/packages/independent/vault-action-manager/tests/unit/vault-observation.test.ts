import { describe, expect, it, mock, spyOn } from "bun:test";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import type { App, TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import type { BulkVaultEvent } from "../../src/impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { VaultObservation } from "../../src/impl/event-processing/vault-observation";

type VaultCallback = (...args: never[]) => void;

function makeHarness(shouldIgnore: (path: string) => boolean) {
	const callbacks = new Map<string, VaultCallback>();
	const listenerRegistrations: string[] = [];
	const removed: unknown[] = [];
	const vault = {
		offref: (ref: unknown) => removed.push(ref),
		on: (name: string, callback: VaultCallback) => {
			listenerRegistrations.push(name);
			callbacks.set(name, callback);
			return { callback, name };
		},
	};
	const app = { vault } as unknown as App;
	const selfEvents = {
		shouldIgnoreEffect: (path: string) =>
			Effect.sync(() => shouldIgnore(path)),
	} as unknown as SelfEventTracker;
	const native = Effect.runSync(
		VaultObservation.makeEffect(app, selfEvents, {
			maxWindowMs: 100,
			quietWindowMs: 10,
		}),
	);
	let pending = Promise.resolve();
	const observation = {
		flushPending: () => {
			pending = pending.then(() =>
				Effect.runPromise(native.flushPendingEffect()),
			);
		},
		start: () => Effect.runSync(native.startEffect()),
		subscribe: (handler: (bulk: BulkVaultEvent) => Promise<void>) => {
			const subscription = Effect.runSync(
				native.subscribeEffect(handler),
			);
			let active = true;
			return () => {
				if (!active) return;
				active = false;
				Effect.runFork(subscription.close);
			};
		},
		whenIdle: async () => {
			await pending;
			await Effect.runPromise(native.whenIdleEffect());
		},
	};
	return {
		app,
		callbacks,
		listenerRegistrations,
		observation,
		removed,
		selfEvents,
	};
}

function mdFile(path: string): TAbstractFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
	file.extension = "md";
	return file;
}

describe("VaultObservation", () => {
	it("does not acquire listeners when started before the first subscriber", () => {
		const { listenerRegistrations, observation } = makeHarness(() => false);

		observation.start();
		observation.start();

		expect(listenerRegistrations).toEqual([]);
	});

	it("acquires each listener once and releases them on final teardown", () => {
		const { listenerRegistrations, observation, removed } = makeHarness(
			() => false,
		);

		observation.start();
		const teardownFirst = observation.subscribe(async () => {});
		const teardownSecond = observation.subscribe(async () => {});
		observation.start();

		expect(listenerRegistrations).toEqual(["create", "rename", "delete"]);

		teardownFirst();
		expect(removed).toEqual([]);

		teardownSecond();
		expect(removed).toHaveLength(3);
	});

	it("acquires each listener once under concurrent subscriptions", async () => {
		const { app, listenerRegistrations, selfEvents } = makeHarness(
			() => false,
		);

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
				);
				yield* observation.startEffect();
				const subscriptions = yield* Effect.all(
					[
						observation.subscribeEffect(async () => {}),
						observation.subscribeEffect(async () => {}),
					],
					{ concurrency: "unbounded" },
				);

				expect(listenerRegistrations).toEqual([
					"create",
					"rename",
					"delete",
				]);

				yield* Effect.all(subscriptions.map(({ close }) => close));
				yield* observation.disposeEffect();
			}),
		);
	});

	it("reacquires one listener per event after observation restarts", () => {
		const { listenerRegistrations, observation, removed } = makeHarness(
			() => false,
		);

		observation.start();
		const teardown = observation.subscribe(async () => {});
		teardown();
		const teardownRestarted = observation.subscribe(async () => {});

		expect(listenerRegistrations).toEqual([
			"create",
			"rename",
			"delete",
			"create",
			"rename",
			"delete",
		]);
		expect(removed).toHaveLength(3);

		teardownRestarted();
		expect(removed).toHaveLength(6);
	});

	it("drops the pending window when the final subscriber tears down", async () => {
		const { callbacks, observation } = makeHarness(() => false);
		const staleBulks: BulkVaultEvent[] = [];

		observation.start();
		const teardown = observation.subscribe(async (bulk) => {
			staleBulks.push(bulk);
		});
		callbacks.get("create")?.(mdFile("Library/stale.md") as never);

		teardown();
		const restartedBulks: BulkVaultEvent[] = [];
		observation.subscribe(async (bulk) => {
			restartedBulks.push(bulk);
		});
		observation.flushPending();
		await observation.whenIdle();

		expect(staleBulks).toEqual([]);
		expect(restartedBulks).toEqual([]);

		callbacks.get("create")?.(mdFile("Library/fresh.md") as never);
		observation.flushPending();
		await observation.whenIdle();

		expect(restartedBulks).toHaveLength(1);
		expect(restartedBulks[0]?.events[0]?.kind).toBe("FileCreated");
	});

	it("attributes create and delete callbacks exactly once", async () => {
		const observedPaths: string[] = [];
		const { callbacks, observation } = makeHarness((path) => {
			observedPaths.push(path);
			return false;
		});
		const bulks: BulkVaultEvent[] = [];

		observation.start();
		observation.subscribe(async (bulk) => {
			bulks.push(bulk);
		});
		callbacks.get("create")?.(mdFile("Library/created.md") as never);
		callbacks.get("delete")?.(mdFile("Library/deleted.md") as never);
		observation.flushPending();
		await observation.whenIdle();

		expect(observedPaths).toEqual([
			"Library/created.md",
			"Library/deleted.md",
		]);
		expect(bulks).toHaveLength(1);
		expect(bulks[0]?.events.map((event) => event.kind)).toEqual([
			"FileCreated",
			"FileDeleted",
		]);
		expect(bulks[0]?.roots.map((event) => event.kind)).toEqual([
			"FileDeleted",
		]);
	});

	it("attributes both rename paths once and keeps a partially matched rename", async () => {
		const observedPaths: string[] = [];
		const { callbacks, observation } = makeHarness((path) => {
			observedPaths.push(path);
			return path === "Library/new.md";
		});
		const bulks: BulkVaultEvent[] = [];

		observation.subscribe(async (bulk) => {
			bulks.push(bulk);
		});
		observation.start();
		callbacks.get("rename")?.(
			mdFile("Library/new.md") as never,
			"Library/old.md" as never,
		);
		observation.flushPending();
		await observation.whenIdle();

		expect(observedPaths).toEqual(["Library/new.md", "Library/old.md"]);
		expect(bulks).toHaveLength(1);
		expect(bulks[0]?.events[0]?.kind).toBe("FileRenamed");
	});

	it("attributes both rename paths once and filters a fully matched Self Event", async () => {
		const observedPaths: string[] = [];
		const { callbacks, observation } = makeHarness((path) => {
			observedPaths.push(path);
			return true;
		});
		const handler = mock(async () => {});

		observation.subscribe(handler);
		observation.start();
		callbacks.get("rename")?.(
			mdFile("Library/new.md") as never,
			"Library/old.md" as never,
		);
		observation.flushPending();
		await observation.whenIdle();

		expect(observedPaths).toEqual(["Library/new.md", "Library/old.md"]);
		expect(handler).not.toHaveBeenCalled();
	});

	it("publishes the same Bulk Vault Event to every subscriber", async () => {
		const { callbacks, observation } = makeHarness(() => false);
		const first: BulkVaultEvent[] = [];
		const second: BulkVaultEvent[] = [];

		observation.start();
		observation.subscribe(async (bulk) => {
			first.push(bulk);
		});
		observation.subscribe(async (bulk) => {
			second.push(bulk);
		});
		callbacks.get("create")?.(mdFile("Library/shared.md") as never);
		observation.flushPending();
		await observation.whenIdle();

		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
		expect(first[0]).toBe(second[0]);
	});

	it("isolates a failed subscriber from the other subscribers", async () => {
		const errorLog = spyOn(console, "error").mockImplementation(() => {});
		const { callbacks, observation } = makeHarness(() => false);
		const received: BulkVaultEvent[] = [];

		try {
			observation.start();
			observation.subscribe(async () => {
				throw new Error("subscriber failed");
			});
			observation.subscribe(async (bulk) => {
				received.push(bulk);
			});
			callbacks.get("create")?.(
				mdFile("Library/still-delivered.md") as never,
			);
			observation.flushPending();
			await observation.whenIdle();

			expect(received).toHaveLength(1);
			expect(received[0]?.events[0]?.kind).toBe("FileCreated");
		} finally {
			errorLog.mockRestore();
		}
	});

	it("flushes after the quiet window using TestClock", async () => {
		const { app, callbacks, selfEvents } = makeHarness(() => false);
		const bulks: BulkVaultEvent[] = [];

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
					{
						maxWindowMs: 500,
						quietWindowMs: 100,
					},
				);
				yield* observation.startEffect();
				const subscription = yield* observation.subscribeEffect(
					async (bulk) => {
						bulks.push(bulk);
					},
				);

				callbacks.get("create")?.(mdFile("Library/quiet.md") as never);
				yield* TestClock.adjust(99);
				expect(bulks).toEqual([]);

				yield* TestClock.adjust(1);
				yield* observation.whenIdleEffect();
				expect(bulks).toHaveLength(1);
				expect(bulks[0]?.debug.startedAt).toBe(0);
				expect(bulks[0]?.debug.endedAt).toBe(100);

				yield* subscription.close;
				yield* observation.disposeEffect();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("continuous events cannot postpone a flush beyond the maximum window", async () => {
		const { app, callbacks, selfEvents } = makeHarness(() => false);
		const bulks: BulkVaultEvent[] = [];

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
					{
						maxWindowMs: 250,
						quietWindowMs: 100,
					},
				);
				yield* observation.startEffect();
				const subscription = yield* observation.subscribeEffect(
					async (bulk) => {
						bulks.push(bulk);
					},
				);

				callbacks.get("create")?.(mdFile("Library/one.md") as never);
				yield* TestClock.adjust(80);
				callbacks.get("create")?.(mdFile("Library/two.md") as never);
				yield* TestClock.adjust(80);
				callbacks.get("create")?.(mdFile("Library/three.md") as never);
				yield* TestClock.adjust(80);
				expect(bulks).toEqual([]);

				yield* TestClock.adjust(10);
				yield* observation.whenIdleEffect();
				expect(bulks).toHaveLength(1);
				expect(bulks[0]?.events).toHaveLength(3);
				expect(bulks[0]?.debug.endedAt).toBe(250);

				yield* subscription.close;
				yield* observation.disposeEffect();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("processes each subscriber serially", async () => {
		const { app, callbacks, selfEvents } = makeHarness(() => false);
		const order: string[] = [];
		let releaseFirst = () => {};
		const firstCanFinish = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
				);
				yield* observation.startEffect();
				let handled = 0;
				const subscription = yield* observation.subscribeEffect(
					async () => {
						handled++;
						order.push(`start-${handled}`);
						if (handled === 1) await firstCanFinish;
						order.push(`end-${handled}`);
					},
				);

				callbacks.get("create")?.(mdFile("Library/one.md") as never);
				yield* observation.flushPendingEffect();
				callbacks.get("create")?.(mdFile("Library/two.md") as never);
				yield* observation.flushPendingEffect();
				yield* Effect.yieldNow;
				expect(order).toEqual(["start-1"]);

				releaseFirst();
				yield* observation.whenIdleEffect();
				expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);

				yield* subscription.close;
				yield* observation.disposeEffect();
			}),
		);
	});

	it("subscription teardown interrupts active handler tracking", async () => {
		const { app, callbacks, selfEvents } = makeHarness(() => false);
		let markStarted = () => {};
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
				);
				yield* observation.startEffect();
				const subscription = yield* observation.subscribeEffect(
					async () => {
						markStarted();
						await new Promise<void>(() => {});
					},
				);

				callbacks.get("create")?.(
					mdFile("Library/in-flight.md") as never,
				);
				yield* observation.flushPendingEffect();
				yield* Effect.promise(() => started);
				expect(yield* observation.activeHandlerCountEffect()).toBe(1);

				yield* subscription.close;
				expect(yield* observation.activeHandlerCountEffect()).toBe(0);
				yield* observation.disposeEffect();
			}),
		);
	});

	it("dispose completes a pending whenIdle barrier", async () => {
		const { app, callbacks, selfEvents } = makeHarness(() => false);
		let markStarted = () => {};
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});

		await Effect.runPromise(
			Effect.gen(function* () {
				const observation = yield* VaultObservation.makeEffect(
					app,
					selfEvents,
				);
				yield* observation.startEffect();
				yield* observation.subscribeEffect(async () => {
					markStarted();
					await new Promise<void>(() => {});
				});

				callbacks.get("create")?.(
					mdFile("Library/in-flight.md") as never,
				);
				const idle = yield* observation
					.whenIdleEffect()
					.pipe(Effect.forkChild);
				yield* Effect.promise(() => started);

				yield* observation.disposeEffect();
				yield* Fiber.join(idle);
				expect(yield* observation.activeHandlerCountEffect()).toBe(0);
			}),
		);
	});
});
