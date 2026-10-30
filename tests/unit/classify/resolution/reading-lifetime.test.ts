import { describe, expect, it } from "bun:test";
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { readingNotePath } from "@textfresser/lemma-note-codec";
import type * as Dumling from "dumling/types";
import { Deferred, Effect, Exit, ManagedRuntime, Scope } from "effect";
import { TestClock } from "effect/testing";
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
const linkTo = (reading: Dumling.Reading<"de">, shown: string) =>
	`[[${notePath(reading).replace(/\.md$/u, "")}|${shown}]]`;

/**
 * A store holding gehen 🚶 (attested), laufen 🏃 and springen 🦘 (linked
 * by Classify, never clicked), and two Scrolls held in memory.
 */
async function storeWithReadings() {
	const { store, vault } = await openStore();
	await seed(store, [
		createLemma(gehen),
		createSurface(gehtSurfaceEntry),
		createReading(
			readingEntry(gehenReading, {
				attestationLinks: [
					{
						reading: gehenReading,
						ref: "![[Story#^0|^00000000]]",
						surfaceId: gehtSurfaceEntry.id,
					},
				],
			}),
		),
		createLemma(laufen),
		createReading(readingEntry(laufenReading)),
		createLemma(springen),
		createReading(readingEntry(springenReading)),
	]);
	const files: Record<string, string> = {
		[STORY]: `Er ${linkTo(gehenReading, "geht")}, ${linkTo(laufenReading, "läuft")}. ^0\n`,
		[TALE]: `Sie ${linkTo(laufenReading, "läuft")} und ${linkTo(springenReading, "springt")}.\n`,
	};
	return { files, store, vault };
}

const stored = async (store: DumdictVaultStore, reading: Dumling.Reading<"de">) =>
	(await run(store.readingLocation(reading))) !== undefined;

/**
 * The lifetime on a runtime of its own, whose `TestClock` moves only when
 * the test adjusts it.
 */
function lifetimeOver(
	options: {
		readonly store: DumdictVaultStore;
		readonly vaultPaths: () => readonly string[];
		readonly files: Record<string, string>;
		readonly settled?: Effect.Effect<void>;
	} & Partial<Pick<ReadingLifetimeDeps, "activity" | "knowledge" | "blockedBy" | "quietMs" | "sweepQuietMs">>,
) {
	const runtime = ManagedRuntime.make(TestClock.layer());
	const scope = Scope.makeUnsafe();
	const links = memoryNoteLinks(
		() => options.files,
		() => [...options.vaultPaths(), ...Object.keys(options.files)],
	);
	const lifetime = runtime.runSync(
		Scope.provide(scope)(
			makeReadingLifetime({
				activity: options.activity ?? createScrollActivity(),
				...(options.blockedBy === undefined ? {} : { blockedBy: options.blockedBy }),
				...(options.knowledge === undefined ? {} : { knowledge: options.knowledge }),
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
		modified: (paths: readonly string[]) => runtime.runPromise(lifetime.modified(paths)),
		/** Obsidian resolved the files at `paths` again. */
		relinked: async (paths: readonly string[]) => {
			for (const path of paths)
				await runtime.runPromise(lifetime.changed({ _tag: "Resolved", path }));
		},
		run: <A>(effect: Effect.Effect<A>) => runtime.runPromise(effect),
		suspect: (paths: readonly string[]) => runtime.runPromise(lifetime.suspect(paths)),
		sweep: () => runtime.runPromise(lifetime.sweep),
		whenIdle: () => runtime.runPromise(lifetime.whenIdle),
	};
}

describe("Reading lifetime", () => {
	it("removes an unclicked Reading whose last link the user deleted, with its Lemma", async () => {
		const { files, store, vault } = await storeWithReadings();
		const lifetime = lifetimeOver({ files, store, vaultPaths: () => vault.markdownPaths() });
		await lifetime.relinked([STORY, TALE]);
		await lifetime.whenIdle();

		// 🦘's only link goes: it has no Attestation, so it goes.
		files[TALE] = `Sie ${linkTo(laufenReading, "läuft")} und springt.\n`;
		await lifetime.relinked([TALE]);
		await lifetime.whenIdle();
		expect(await stored(store, springenReading)).toBe(false);
		expect(await run(store.lemmaNote(springen))).toBeUndefined();
		expect(vault.content(notePath(springenReading))).toBeUndefined();
		expect(await stored(store, laufenReading)).toBe(true);
	});

	it("keeps a Reading another Scroll still links, and removes it once that Scroll is deleted", async () => {
		const { files, store, vault } = await storeWithReadings();
		const lifetime = lifetimeOver({ files, store, vaultPaths: () => vault.markdownPaths() });
		await lifetime.relinked([STORY, TALE]);

		// Story no longer links 🏃, but Tale does.
		files[STORY] = `Er ${linkTo(gehenReading, "geht")}, läuft. ^0\n`;
		await lifetime.relinked([STORY]);
		await lifetime.whenIdle();
		expect(await stored(store, laufenReading)).toBe(true);

		// Tale is deleted: 🏃 and 🦘 lose their last links.
		delete files[TALE];
		await lifetime.changed({ _tag: "Deleted", path: TALE });
		await lifetime.whenIdle();
		expect(await stored(store, laufenReading)).toBe(false);
		expect(await stored(store, springenReading)).toBe(false);
		// 🚶 keeps its Attestation.
		expect(await stored(store, gehenReading)).toBe(true);
	});

	it("keeps a Reading with an Attestation though no link names it", async () => {
		const { files, store, vault } = await storeWithReadings();
		const lifetime = lifetimeOver({ files, store, vaultPaths: () => vault.markdownPaths() });
		await lifetime.relinked([STORY]);
		files[STORY] = "Er geht, läuft. ^0\n";
		await lifetime.relinked([STORY]);
		await lifetime.suspect([notePath(gehenReading)]);
		await lifetime.whenIdle();
		expect(await stored(store, gehenReading)).toBe(true);
		// 🏃 is still linked from Tale.
		expect(await stored(store, laufenReading)).toBe(true);
	});

	it("counts the links of a note moved into Worter/ no more", async () => {
		const { files, store, vault } = await storeWithReadings();
		const lifetime = lifetimeOver({ files, store, vaultPaths: () => vault.markdownPaths() });
		await lifetime.relinked([STORY, TALE]);
		const moved = "Worter/Tale.md";
		files[moved] = files[TALE] ?? "";
		delete files[TALE];
		await lifetime.changed({ _tag: "Renamed", from: TALE, to: moved });
		await lifetime.whenIdle();
		expect(await stored(store, springenReading)).toBe(false);
		// Story still links 🏃.
		expect(await stored(store, laufenReading)).toBe(true);
	});

	describe("startup sweep", () => {
		it("removes every Reading with no Attestation and no link, once Obsidian has resolved every file", async () => {
			const { files, store, vault } = await storeWithReadings();
			// Tale went while the plugin was not running.
			delete files[TALE];
			const resolved = Deferred.makeUnsafe<void>();
			const lifetime = lifetimeOver({
				files,
				settled: Deferred.await(resolved),
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.sweep();
			await lifetime.adjust(1_000);
			// The metadata cache is still resolving: nothing is judged.
			expect(await stored(store, springenReading)).toBe(true);
			await lifetime.run(Deferred.succeed(resolved, undefined));
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(false);
			expect(await stored(store, laufenReading)).toBe(true);
			expect(await stored(store, gehenReading)).toBe(true);
		});

		it("waits for the vault to be quiet, as Sync catches up", async () => {
			const { files, store, vault } = await storeWithReadings();
			delete files[TALE];
			const lifetime = lifetimeOver({
				files,
				quietMs: 1_000,
				store,
				sweepQuietMs: 3_000,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.modified(["Library/Other.md"]);
			await lifetime.sweep();
			await lifetime.adjust(2_000);
			expect(await stored(store, springenReading)).toBe(true);
			// Sync brings Tale back before the vault goes quiet.
			files[TALE] = `Sie ${linkTo(springenReading, "springt")}.\n`;
			await lifetime.modified([TALE]);
			await lifetime.adjust(3_000);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(true);
		});

		it("then follows the links it read, so a link deleted after it is caught", async () => {
			const { files, store, vault } = await storeWithReadings();
			const lifetime = lifetimeOver({ files, store, vaultPaths: () => vault.markdownPaths() });
			await lifetime.sweep();
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(true);
			files[TALE] = "Sie läuft und springt.\n";
			await lifetime.relinked([TALE]);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(false);
			expect(await stored(store, laufenReading)).toBe(true);
		});
	});

	describe("races", () => {
		it("removes nothing while a Classify run goes on any Scroll, and judges once it has ended and its links are saved", async () => {
			const { files, store, vault } = await storeWithReadings();
			const activity = createScrollActivity();
			const lifetime = lifetimeOver({
				activity,
				files,
				quietMs: 1_000,
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.relinked([STORY, TALE]);
			const end = await lifetime.run(activity.begin("Library/Other.md"));
			files[TALE] = `Sie ${linkTo(laufenReading, "läuft")} und springt.\n`;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(5_000);
			expect(await stored(store, springenReading)).toBe(true);
			// The run ends, having linked 🦘 in another Scroll.
			files["Library/Other.md"] = `${linkTo(springenReading, "springt")}\n`;
			await lifetime.run(end);
			await lifetime.relinked(["Library/Other.md"]);
			await lifetime.adjust(5_000);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(true);
		});

		it("removes nothing when a Classify run starts after the check read the Readings, and checks again once it ends", async () => {
			const { files, store, vault } = await storeWithReadings();
			const activity = createScrollActivity();
			const resolved = Deferred.makeUnsafe<void>();
			let ending: Effect.Effect<void> | undefined;
			const lifetime = lifetimeOver({
				activity,
				files,
				quietMs: 1_000,
				// The check waits for the metadata cache; a run starts meanwhile.
				settled: Effect.suspend(() =>
					Deferred.await(resolved).pipe(
						Effect.andThen(
							ending === undefined
								? activity.begin("Library/Other.md").pipe(
										Effect.map((end) => {
											ending = end;
										}),
									)
								: Effect.void,
						),
					),
				),
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.relinked([STORY, TALE]);
			files[TALE] = `Sie ${linkTo(laufenReading, "läuft")} und springt.\n`;
			await lifetime.relinked([TALE]);
			await lifetime.run(Deferred.succeed(resolved, undefined));
			await lifetime.adjust(1_000);
			// The check found 🦘 unlinked, but the run began before its plan.
			expect(ending).toBeDefined();
			expect(await stored(store, springenReading)).toBe(true);
			// The run ends without linking 🦘: the next check removes it.
			await lifetime.run(ending ?? Effect.void);
			await lifetime.adjust(1_000);
			await lifetime.adjust(1_000);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(false);
		});

		it("waits out a Knowledge run and a dictionary reset", async () => {
			const { files, store, vault } = await storeWithReadings();
			let running = 1;
			let blocked: string | undefined = "a reset is running";
			const lifetime = lifetimeOver({
				blockedBy: () => blocked,
				files,
				knowledge: { running: Effect.sync(() => running) },
				quietMs: 1_000,
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.relinked([STORY, TALE]);
			files[TALE] = `Sie ${linkTo(laufenReading, "läuft")} und springt.\n`;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(3_000);
			expect(await stored(store, springenReading)).toBe(true);
			blocked = undefined;
			await lifetime.adjust(3_000);
			expect(await stored(store, springenReading)).toBe(true);
			running = 0;
			await lifetime.adjust(1_000);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(false);
		});

		it("waits for a link in flux to settle: cut from one note, pasted into another", async () => {
			const { files, store, vault } = await storeWithReadings();
			const lifetime = lifetimeOver({
				files,
				quietMs: 5_000,
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.relinked([STORY, TALE]);
			files[TALE] = `Sie ${linkTo(laufenReading, "läuft")} und springt.\n`;
			await lifetime.relinked([TALE]);
			await lifetime.adjust(3_000);
			files["Library/Notes.md"] = `${linkTo(springenReading, "springt")}\n`;
			await lifetime.relinked(["Library/Notes.md"]);
			await lifetime.adjust(10_000);
			await lifetime.whenIdle();
			expect(await stored(store, springenReading)).toBe(true);
		});

		it("drops its pending check when its scope closes", async () => {
			const { files, store, vault } = await storeWithReadings();
			const lifetime = lifetimeOver({
				files,
				quietMs: 1_000,
				store,
				vaultPaths: () => vault.markdownPaths(),
			});
			await lifetime.relinked([STORY, TALE]);
			files[TALE] = "Sie läuft und springt.\n";
			await lifetime.relinked([TALE]);
			await lifetime.close();
			await lifetime.adjust(5_000);
			expect(await stored(store, springenReading)).toBe(true);
		});
	});
});
