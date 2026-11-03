import { describe, expect, it } from "bun:test";
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { lemmaNotePath, readingNotePath } from "@textfresser/lemma-note-codec";
import type * as Dumling from "dumling/types";
import { Deferred, Effect, Exit, ManagedRuntime, Scope } from "effect";
import { TestClock } from "effect/testing";
import { cleanupUnlinkedReadings } from "../../../../src/commanders/classify/cleanup-unlinked";
import {
	type LinkIndexSnapshot,
	memoryLinkIndex,
} from "../../../../src/commanders/classify/resolution/link-index";
import {
	type LinkChange,
	makeReadingLifetime,
	type ReadingLifetimeDeps,
} from "../../../../src/commanders/classify/resolution/reading-lifetime";
import { createScrollActivity } from "../../../../src/commanders/classify/resolution/scroll-activity";
import {
	createLemma,
	createReading,
	createSurface,
	gehen,
	gehenReading,
	gehtSurfaceEntry,
	laufen,
	laufenReading,
	readingEntry,
	springen,
	springenReading,
} from "../../../../src/packages/composed/dictionary/tests/support/fixtures";
import { openStore, seed } from "../../../../src/packages/composed/dictionary/tests/support/store";
import { memoryNoteLinks, run } from "./support";

const STORY = "Library/Story.md";
const TALE = "Library/Tale.md";
const notePath = (reading: Dumling.Reading<"de">) => readingNotePath(reading).path;
const linkTo = (path: string, shown: string) => `[[${path.replace(/\.md$/u, "")}|${shown}]]`;
const linkToReading = (reading: Dumling.Reading<"de">, shown: string) =>
	linkTo(notePath(reading), shown);

/**
 * A store holding gehen 🚶 (attested), laufen 🏃 and springen 🦘 (linked
 * by Classify, never clicked), and two Scrolls held in memory: Story links
 * 🚶 and 🏃, Tale links 🏃 and 🦘.
 */
async function storeWithReadings() {
	const { store, vault } = await openStore();
	await seed(store, [
		createLemma(gehen),
		createSurface(gehtSurfaceEntry),
		createReading(
			readingEntry(gehenReading, {
				attestationLinks: [
					{ reading: gehenReading, ref: "![[Story#^0|^00000000]]", surfaceId: gehtSurfaceEntry.id },
				],
			}),
		),
		createLemma(laufen),
		createReading(readingEntry(laufenReading)),
		createLemma(springen),
		createReading(readingEntry(springenReading)),
	]);
	const files: Record<string, string> = {
		[STORY]: `Er ${linkToReading(gehenReading, "geht")}, ${linkToReading(laufenReading, "läuft")}. ^0\n`,
		[TALE]: `Sie ${linkToReading(laufenReading, "läuft")} und ${linkToReading(springenReading, "springt")}.\n`,
	};
	return { files, store, vault };
}

const TALE_WITHOUT_SPRINGEN = `Sie ${linkToReading(laufenReading, "läuft")} und springt.\n`;

const stored = async (store: DumdictVaultStore, reading: Dumling.Reading<"de">) =>
	(await run(store.readingLocation(reading))) !== undefined;

/**
 * The lifetime on a runtime of its own, whose `TestClock` moves only when
 * the test adjusts it. Its index is in memory, so a second lifetime over
 * the same `index` is the plugin after a restart.
 */
function lifetimeOver(
	options: {
		readonly store: DumdictVaultStore;
		readonly vaultPaths: () => readonly string[];
		readonly files: Record<string, string>;
		readonly canvases?: Record<string, readonly string[]>;
		readonly settled?: Effect.Effect<void>;
		readonly index?: ReturnType<typeof memoryLinkIndex>;
	} & Partial<Pick<ReadingLifetimeDeps, "activity" | "knowledge" | "blockedBy" | "quietMs" | "sweepQuietMs">>,
) {
	const runtime = ManagedRuntime.make(TestClock.layer());
	const scope = Scope.makeUnsafe();
	const index = options.index ?? memoryLinkIndex();
	const links = memoryNoteLinks(
		() => options.files,
		() => [...options.vaultPaths(), ...Object.keys(options.files)],
		() => options.canvases ?? {},
	);
	const lifetime = runtime.runSync(
		Scope.provide(scope)(
			makeReadingLifetime({
				activity: options.activity ?? createScrollActivity(),
				...(options.blockedBy === undefined ? {} : { blockedBy: options.blockedBy }),
				...(options.knowledge === undefined ? {} : { knowledge: options.knowledge }),
				index,
				links: { ...links, settled: options.settled ?? Effect.void },
				quietMs: options.quietMs ?? 0,
				store: Effect.succeed(options.store),
				sweepQuietMs: options.sweepQuietMs ?? 0,
			}),
		),
	);
	return {
		adjust: (millis: number) => runtime.runPromise(TestClock.adjust(millis)),
		changed: (change: LinkChange) => runtime.runPromise(lifetime.changed(change)),
		close: () => runtime.runPromise(Scope.close(scope, Exit.void)),
		index,
		lifetime,
		modified: (paths: readonly string[]) => runtime.runPromise(lifetime.modified(paths)),
		/** Obsidian resolved the files at `paths` again. */
		relinked: async (paths: readonly string[]) => {
			for (const path of paths)
				await runtime.runPromise(lifetime.changed({ _tag: "Resolved", path }));
		},
		run: <A, E>(effect: Effect.Effect<A, E>) => runtime.runPromise(effect),
		start: () => runtime.runPromise(lifetime.start),
		suspect: (paths: readonly string[]) => runtime.runPromise(lifetime.suspect(paths)),
		whenIdle: () => runtime.runPromise(lifetime.whenIdle),
	};
}

/** A lifetime over `files`, started: its index holds their links. */
async function started(setup: Awaited<ReturnType<typeof storeWithReadings>>, options: Partial<Parameters<typeof lifetimeOver>[0]> = {}) {
	const lifetime = lifetimeOver({
		files: setup.files,
		store: setup.store,
		vaultPaths: () => setup.vault.markdownPaths(),
		...options,
	});
	await lifetime.start();
	await lifetime.whenIdle();
	return lifetime;
}

describe("Reading lifetime", () => {
	describe("a transition it saw", () => {
		it("removes an unclicked Reading once an edited Scroll drops its last link, with its Lemma", async () => {
			const setup = await storeWithReadings();
			const { files, store, vault } = setup;
			const lifetime = await started(setup);
			files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(false);
			expect(await run(store.lemmaNote(springen))).toBeUndefined();
			expect(vault.content(notePath(springenReading))).toBeUndefined();
			expect(await stored(store, laufenReading)).toBe(true);
		});

		it("keeps a Reading another Scroll still links", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup);
			setup.files[STORY] = `Er ${linkToReading(gehenReading, "geht")}, läuft. ^0\n`;
			await lifetime.relinked([STORY]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, laufenReading)).toBe(true);
		});

		it("keeps a Reading a canvas links", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup, {
				canvases: { "Library/Board.canvas": [notePath(springenReading)] },
			});
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("keeps a Reading whose Lemma note a file links", async () => {
			const setup = await storeWithReadings();
			setup.files["Library/Notiz.md"] = `${linkTo(lemmaNotePath(springen).path, "springen")}\n`;
			const lifetime = await started(setup);
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("keeps a Reading whose note the user renamed with link updating off: the link into Worter/ resolves to nothing", async () => {
			const setup = await storeWithReadings();
			let renamed = false;
			const lifetime = await started(setup, {
				vaultPaths: () =>
					setup.vault
						.markdownPaths()
						.filter((path) => !(renamed && path === notePath(springenReading))),
			});
			renamed = true;
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
			// It still counts as linking 🦘.
			expect(lifetime.index.current()?.links[TALE]).toContain(notePath(springenReading));
		});

		it("waits for the unlink observer when the Reading still has an Attestation, then removes it", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup);
			setup.files[STORY] = `Er geht, ${linkToReading(laufenReading, "läuft")}. ^0\n`;
			await lifetime.relinked([STORY]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, gehenReading)).toBe(true);
			expect(lifetime.index.current()?.released).toContain(notePath(gehenReading));
		});
	});

	describe("never on absence", () => {
		it("removes nothing when a Scroll is deleted, and nothing once it is restored", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup);
			const tale = setup.files[TALE] ?? "";
			delete setup.files[TALE];
			await lifetime.changed({ _tag: "Deleted", path: TALE });
			await lifetime.adjust(60_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
			// Restored from the trash a minute later.
			setup.files[TALE] = tale;
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("removes nothing when a Scroll moves into Worter/", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup);
			const moved = "Worter/Tale.md";
			setup.files[moved] = setup.files[TALE] ?? "";
			delete setup.files[TALE];
			await lifetime.changed({ _tag: "Renamed", from: TALE, to: moved });
			await lifetime.relinked([moved]);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("deletes nothing at startup on a second device whose Scrolls Sync has not brought yet", async () => {
			const setup = await storeWithReadings();
			// Sync brought the dictionary; the Scrolls arrive later.
			const scrolls = { ...setup.files };
			for (const path of Object.keys(setup.files)) delete setup.files[path];
			const lifetime = await started(setup);
			await lifetime.adjust(60_000);
			await lifetime.whenIdle();
			for (const reading of [gehenReading, laufenReading, springenReading])
				expect(await stored(setup.store, reading)).toBe(true);
			// The Scrolls arrive, as Obsidian resolves each: nothing goes.
			Object.assign(setup.files, scrolls);
			await lifetime.relinked(Object.keys(scrolls));
			await lifetime.whenIdle();
			for (const reading of [gehenReading, laufenReading, springenReading])
				expect(await stored(setup.store, reading)).toBe(true);
		});

		it("deletes nothing at startup for links removed while it was not running, nor for a Reading the index never saw linked", async () => {
			const setup = await storeWithReadings();
			// The index from the last run: Tale linked 🏃 and 🦘.
			const index = memoryLinkIndex({
				links: { [TALE]: [notePath(laufenReading), notePath(springenReading)] },
				released: [],
			} satisfies LinkIndexSnapshot);
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			const lifetime = await started(setup, { index });
			await lifetime.adjust(60_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
			// The index now holds Tale as it is.
			expect(index.current()?.links[TALE]).toEqual([notePath(laufenReading)]);
		});

		it("follows a transition across a restart, through the index it kept", async () => {
			const setup = await storeWithReadings();
			const first = await started(setup);
			await first.close();
			const again = await started(setup, { index: first.index });
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await again.relinked([TALE]);
			await again.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(false);
		});
	});

	describe("races", () => {
		it("removes nothing while a Classify run goes on any Scroll, and keeps what it linked", async () => {
			const setup = await storeWithReadings();
			const activity = createScrollActivity();
			const lifetime = await started(setup, { activity, quietMs: 1_000 });
			const end = await lifetime.run(activity.begin("Library/Other.md"));
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(5_000);
			expect(await stored(setup.store, springenReading)).toBe(true);
			// The run ends, having linked 🦘 in another Scroll.
			setup.files["Library/Other.md"] = `${linkToReading(springenReading, "springt")}\n`;
			await lifetime.run(end);
			await lifetime.relinked(["Library/Other.md"]);
			await lifetime.adjust(5_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("removes nothing when a Classify run starts after the check read the Readings, and checks again once it ends", async () => {
			const setup = await storeWithReadings();
			const activity = createScrollActivity();
			const resolved = Deferred.makeUnsafe<void>();
			let ending: Effect.Effect<void> | undefined;
			let racing = false;
			const lifetime = await started(setup, {
				activity,
				quietMs: 1_000,
				// The check waits for the metadata cache; a run starts meanwhile.
				settled: Effect.suspend(() =>
					!racing || ending !== undefined
						? Effect.void
						: Deferred.await(resolved).pipe(
								Effect.andThen(activity.begin("Library/Other.md")),
								Effect.map((end) => {
									ending = end;
								}),
							),
				),
			});
			racing = true;
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.run(Deferred.succeed(resolved, undefined));
			await lifetime.adjust(1_000);
			expect(ending).toBeDefined();
			expect(await stored(setup.store, springenReading)).toBe(true);
			// The run ends without linking 🦘: the next check removes it.
			await lifetime.run(ending ?? Effect.void);
			await lifetime.adjust(1_000);
			await lifetime.adjust(1_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(false);
		});

		it("waits out a dictionary reset and a Knowledge run", async () => {
			const setup = await storeWithReadings();
			let running = 1;
			let blocked: string | undefined = "a reset is running";
			const lifetime = await started(setup, {
				blockedBy: () => blocked,
				knowledge: { running: Effect.sync(() => running) },
				quietMs: 1_000,
			});
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(3_000);
			expect(await stored(setup.store, springenReading)).toBe(true);
			blocked = undefined;
			await lifetime.adjust(3_000);
			expect(await stored(setup.store, springenReading)).toBe(true);
			running = 0;
			await lifetime.adjust(1_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(false);
		});

		it("waits for a link in flux to settle: cut from one note, pasted into another", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup, { quietMs: 5_000 });
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(3_000);
			setup.files["Library/Notes.md"] = `${linkToReading(springenReading, "springt")}\n`;
			await lifetime.relinked(["Library/Notes.md"]);
			await lifetime.adjust(10_000);
			await lifetime.whenIdle();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});

		it("drops its pending check when its scope closes", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup, { quietMs: 1_000 });
			setup.files[TALE] = TALE_WITHOUT_SPRINGEN;
			await lifetime.relinked([TALE]);
			await lifetime.close();
			expect(await stored(setup.store, springenReading)).toBe(true);
		});
	});

	describe("Clean up unlinked Readings…", () => {
		/** Tale went while the plugin was not running: 🦘 is unlinked, but nothing saw it go. */
		const unlinkedSetup = async () => {
			const setup = await storeWithReadings();
			delete setup.files[TALE];
			setup.files[STORY] = `Er ${linkToReading(gehenReading, "geht")}. ^0\n`;
			const lifetime = await started(setup);
			return { ...setup, lifetime };
		};

		it("lists the Readings no Attestation or link holds, and removes nothing until confirmed", async () => {
			const { lifetime, store } = await unlinkedSetup();
			const notices: string[] = [];
			const shown: (readonly string[])[] = [];
			const removed = await lifetime.run(
				cleanupUnlinkedReadings({
					confirm: (paths) => Effect.sync(() => (shown.push(paths), false)),
					lifetime: lifetime.lifetime,
					notify: (message) => notices.push(message),
				}),
			);
			expect(removed).toBe(0);
			expect(shown).toEqual([[notePath(laufenReading), notePath(springenReading)].sort()]);
			expect(await stored(store, laufenReading)).toBe(true);
			expect(await stored(store, springenReading)).toBe(true);
			expect(notices).toEqual([]);
		});

		it("removes them on confirm, and names the count", async () => {
			const { lifetime, store } = await unlinkedSetup();
			const notices: string[] = [];
			const removed = await lifetime.run(
				cleanupUnlinkedReadings({
					confirm: () => Effect.succeed(true),
					lifetime: lifetime.lifetime,
					notify: (message) => notices.push(message),
				}),
			);
			expect(removed).toBe(2);
			expect(await stored(store, laufenReading)).toBe(false);
			expect(await stored(store, springenReading)).toBe(false);
			expect(await stored(store, gehenReading)).toBe(true);
			expect(notices).toEqual(["✓ Removed 2 unlinked Readings"]);
		});

		it("keeps one that gained a link between the dry run and the confirm", async () => {
			const { files, lifetime, store } = await unlinkedSetup();
			const notices: string[] = [];
			await lifetime.run(
				cleanupUnlinkedReadings({
					confirm: () =>
						Effect.sync(() => {
							files["Library/Notiz.md"] = `${linkToReading(springenReading, "springt")}\n`;
							return true;
						}),
					lifetime: lifetime.lifetime,
					notify: (message) => notices.push(message),
				}),
			);
			expect(await stored(store, springenReading)).toBe(true);
			expect(await stored(store, laufenReading)).toBe(false);
			expect(notices[0]).toStartWith("✓ Removed 1 unlinked Reading; kept 1");
		});

		it("says so when nothing is unlinked", async () => {
			const setup = await storeWithReadings();
			const lifetime = await started(setup);
			const notices: string[] = [];
			await lifetime.run(
				cleanupUnlinkedReadings({
					confirm: () => Effect.die("asked to confirm nothing"),
					lifetime: lifetime.lifetime,
					notify: (message) => notices.push(message),
				}),
			);
			expect(notices).toEqual(["No unlinked Readings: each has an Attestation or a link"]);
		});
	});
});
