import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import type { App, TAbstractFile } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { makeVaultListen } from "../../src/effect/vam-live";
import {
	type BulkMdModifyEvent,
	scopeMdModifyEvent,
} from "../../src/impl/event-processing/md-modify-event";
import { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { VaultObservation } from "../../src/impl/event-processing/vault-observation";
import { splitPathCodec } from "../../src/split-path-codec";
import type { SplitPathToFolder } from "../../src/types/split-path";

/** A Promise handler as the Effect handler observation runs. */
const viaPromise =
	<M>(handler: (message: M) => Promise<void>) =>
	(message: M) =>
		Effect.promise(() => handler(message));

type VaultCallback = (...args: never[]) => void;

function makeVault() {
	const callbacks = new Map<string, VaultCallback>();
	const registrations: string[] = [];
	const removed: unknown[] = [];
	const app = {
		vault: {
			offref: (ref: unknown) => removed.push(ref),
			on: (name: string, callback: VaultCallback) => {
				registrations.push(name);
				callbacks.set(name, callback);
				return { callback, name };
			},
		},
	} as unknown as App;
	const modify = (file: TAbstractFile) =>
		callbacks.get("modify")?.(file as never);
	return { app, callbacks, modify, registrations, removed };
}

function mdFile(path: string, mtime = 1, size = 10): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
	file.extension = "md";
	file.stat = { ctime: 0, mtime, size };
	return file;
}

function otherFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename =
		path
			.split("/")
			.at(-1)
			?.replace(/\.[^.]+$/, "") ?? "";
	file.extension = path.split(".").at(-1) ?? "";
	file.stat = { ctime: 0, mtime: 1, size: 1 };
	return file;
}

function folder(path: string): TFolder {
	const value = new TFolder();
	value.path = path;
	return value;
}

const paths = (event: BulkMdModifyEvent | undefined) =>
	event?.modifications.map(({ splitPath }) =>
		splitPathCodec.format(splitPath),
	);

function makeObservation(
	app: App,
	options: { maxWindowMs?: number; quietWindowMs?: number } = {},
) {
	return Effect.gen(function* () {
		const selfEvents = yield* SelfEventTracker.makeEffect();
		const observation = yield* VaultObservation.makeMdModifyEffect(
			makeVaultListen(app.vault),
			selfEvents,
			{ maxWindowMs: 100, quietWindowMs: 10, ...options },
		);
		const received: BulkMdModifyEvent[] = [];
		yield* observation.startEffect();
		const subscription = yield* observation.subscribeEffect(
			viaPromise(async (event) => {
				received.push(event);
			}),
		);
		const settle = observation
			.flushPendingEffect()
			.pipe(Effect.andThen(observation.whenIdleEffect()));
		return { observation, received, selfEvents, settle, subscription };
	});
}

describe("Markdown modify observation", () => {
	it("acquires only a modify listener, once, and releases it with the last subscriber", async () => {
		const vault = makeVault();

		await Effect.runPromise(
			Effect.gen(function* () {
				const selfEvents = yield* SelfEventTracker.makeEffect();
				const observation = yield* VaultObservation.makeMdModifyEffect(
					makeVaultListen(vault.app.vault),
					selfEvents,
				);
				const first = yield* observation.subscribeEffect(
					viaPromise(async () => {}),
				);
				expect(vault.registrations).toEqual([]);

				yield* observation.startEffect();
				const second = yield* observation.subscribeEffect(
					viaPromise(async () => {}),
				);
				expect(vault.registrations).toEqual(["modify"]);

				yield* first.close;
				expect(vault.removed).toHaveLength(0);
				yield* second.close;
				expect(vault.removed).toHaveLength(1);
				yield* observation.disposeEffect();
			}),
		);
	});

	it("coalesces repeated modifications per path and keeps the latest stat", async () => {
		const vault = makeVault();

		const received = await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app);
				vault.modify(mdFile("Worter/Hund.md", 1, 10));
				vault.modify(mdFile("Worter/Katze.md", 2, 20));
				vault.modify(mdFile("Worter/Hund.md", 3, 30));
				vault.modify(mdFile("Worter/Hund.md", 4, 40));
				yield* harness.settle;
				yield* harness.observation.disposeEffect();
				return harness.received;
			}),
		);

		expect(received).toHaveLength(1);
		expect(paths(received[0])).toEqual([
			"Worter/Hund.md",
			"Worter/Katze.md",
		]);
		expect(received[0]?.modifications[0]?.stat).toEqual({
			ctime: 0,
			mtime: 4,
			size: 40,
		});
		expect(received[0]?.debug.trueCount).toBe(4);
	});

	it("copies the stat when Obsidian reports the change", async () => {
		const vault = makeVault();
		const file = mdFile("Worter/Hund.md", 1, 10);

		const received = await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app);
				vault.modify(file);
				file.stat.mtime = 99;
				yield* harness.settle;
				yield* harness.observation.disposeEffect();
				return harness.received;
			}),
		);

		expect(received[0]?.modifications[0]?.stat.mtime).toBe(1);
	});

	it("ignores folders and non-Markdown files", async () => {
		const vault = makeVault();

		const received = await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app);
				vault.modify(otherFile("Worter/picture.png"));
				vault.modify(folder("Worter"));
				yield* harness.settle;
				vault.modify(mdFile("Worter/Hund.md"));
				yield* harness.settle;
				yield* harness.observation.disposeEffect();
				return harness.received;
			}),
		);

		expect(received).toHaveLength(1);
		expect(paths(received[0])).toEqual(["Worter/Hund.md"]);
	});

	it("filters VAM's own writes once per expected write", async () => {
		const vault = makeVault();

		const received = await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app);
				yield* harness.selfEvents.expectModifyEffect("Worter/Hund.md");
				vault.modify(mdFile("Worter/Hund.md"));
				yield* harness.settle;
				expect(harness.received).toEqual([]);

				// The expectation was consumed, so a later hand edit is observed.
				vault.modify(mdFile("Worter/Hund.md", 2));
				yield* harness.settle;
				yield* harness.observation.disposeEffect();
				return harness.received;
			}),
		);

		expect(received).toHaveLength(1);
		expect(received[0]?.modifications[0]?.stat.mtime).toBe(2);
	});

	it("drops expectations recorded before the modify listener started", async () => {
		const vault = makeVault();

		const received = await Effect.runPromise(
			Effect.gen(function* () {
				const selfEvents = yield* SelfEventTracker.makeEffect();
				// A VAM write whose callback fired while nobody listened.
				yield* selfEvents.expectModifyEffect("Worter/Hund.md");
				const observation = yield* VaultObservation.makeMdModifyEffect(
					makeVaultListen(vault.app.vault),
					selfEvents,
					{ maxWindowMs: 100, quietWindowMs: 10 },
				);
				const events: BulkMdModifyEvent[] = [];
				yield* observation.startEffect();
				yield* observation.subscribeEffect(
					viaPromise(async (event) => {
						events.push(event);
					}),
				);
				vault.modify(mdFile("Worter/Hund.md"));
				yield* observation.flushPendingEffect();
				yield* observation.whenIdleEffect();
				yield* observation.disposeEffect();
				return events;
			}),
		);

		expect(received).toHaveLength(1);
	});

	it("flushes after the quiet window using TestClock", async () => {
		const vault = makeVault();

		await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app, {
					maxWindowMs: 500,
					quietWindowMs: 100,
				});
				vault.modify(mdFile("Worter/Hund.md"));
				yield* TestClock.adjust(50);
				vault.modify(mdFile("Worter/Hund.md", 2));
				yield* TestClock.adjust(99);
				expect(harness.received).toEqual([]);

				yield* TestClock.adjust(1);
				yield* harness.observation.whenIdleEffect();
				expect(harness.received).toHaveLength(1);
				expect(harness.received[0]?.modifications).toHaveLength(1);
				expect(harness.received[0]?.debug).toEqual({
					endedAt: 150,
					startedAt: 0,
					trueCount: 2,
				});
				yield* harness.subscription.close;
				yield* harness.observation.disposeEffect();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("flushes at the maximum window deadline while edits keep arriving", async () => {
		const vault = makeVault();

		await Effect.runPromise(
			Effect.gen(function* () {
				const harness = yield* makeObservation(vault.app, {
					maxWindowMs: 200,
					quietWindowMs: 100,
				});
				vault.modify(mdFile("Worter/Hund.md", 1));
				yield* TestClock.adjust(90);
				vault.modify(mdFile("Worter/Hund.md", 2));
				yield* TestClock.adjust(90);
				vault.modify(mdFile("Worter/Hund.md", 3));
				yield* TestClock.adjust(19);
				expect(harness.received).toEqual([]);

				yield* TestClock.adjust(1);
				yield* harness.observation.whenIdleEffect();
				expect(harness.received).toHaveLength(1);
				expect(harness.received[0]?.modifications[0]?.stat.mtime).toBe(
					3,
				);
				expect(harness.received[0]?.debug).toEqual({
					endedAt: 200,
					startedAt: 0,
					trueCount: 3,
				});

				vault.modify(mdFile("Worter/Hund.md", 4));
				yield* harness.settle;
				expect(harness.received).toHaveLength(2);
				yield* harness.subscription.close;
				yield* harness.observation.disposeEffect();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});
});

describe("scopeMdModifyEvent", () => {
	const event: BulkMdModifyEvent = {
		debug: { endedAt: 2, startedAt: 1, trueCount: 3 },
		modifications: [
			"Worter/Hund.md",
			"Worter2/Katze.md",
			"Library/Worter/Maus.md",
		].map((path) => {
			const splitPath = splitPathCodec.parse(path);
			if (splitPath.kind !== "MdFile") throw new Error(path);
			return {
				origin: { kind: "External" } as const,
				splitPath,
				stat: { ctime: 0, mtime: 1, size: 1 },
			};
		}),
	};
	const worter: SplitPathToFolder = {
		basename: "Worter",
		kind: "Folder",
		pathParts: [],
	};

	it("keeps only descendants of the folder, not sibling prefixes", () => {
		expect(paths(scopeMdModifyEvent(event, worter) ?? undefined)).toEqual([
			"Worter/Hund.md",
		]);
	});

	it("keeps everything for the vault root", () => {
		expect(scopeMdModifyEvent(event, splitPathCodec.root)).toEqual(event);
	});

	it("returns null when nothing is in scope", () => {
		expect(
			scopeMdModifyEvent(event, {
				basename: "Elsewhere",
				kind: "Folder",
				pathParts: [],
			}),
		).toBeNull();
	});
});
