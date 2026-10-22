import { describe, expect, it } from "bun:test";
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { lemmaNotePath, readingNotePath } from "@textfresser/lemma-note-codec";
import { makeSurfaceId } from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import { createDumdictPlanner } from "dumdict/planning";
import { createDumgen, type Unit } from "dumgen";
import type * as Dumling from "dumling/types";
import { Effect, Layer } from "effect";
import {
	ClassifySegmenter,
	classifySelection,
} from "../../../../src/commanders/classify/classify-selection";
import { dumgenUnitResolver } from "../../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import {
	createScrollActivity,
	type ScrollActivity,
} from "../../../../src/commanders/classify/resolution/scroll-activity";
import { occurrenceKeyOf } from "../../../../src/commanders/classify/resolution/scroll-links";
import {
	createUnlinkObserver,
	type UnlinkStore,
} from "../../../../src/commanders/classify/resolution/unlink-observer";
import {
	memorySegmentationCache,
	SegmentationCache,
} from "../../../../src/commanders/classify/segmentation-cache";
import { UnitResolver } from "../../../../src/commanders/classify/unit-resolver";
import { createScriptedJev } from "../../../../src/managers/dumgen/scripted-jev";
import { FakeVault } from "../../../../src/packages/composed/dictionary/tests/support/fake-vault";
import {
	createLemma,
	createReading,
	readingEntry,
} from "../../../../src/packages/composed/dictionary/tests/support/fixtures";
import { openStore, seed } from "../../../../src/packages/composed/dictionary/tests/support/store";
import { FAENGT_AN_ANSWERS, selectionOf } from "../support";
import {
	attestationOf,
	planFor,
	resolutionHarness,
	run,
	stubDumgen,
	unit,
} from "./support";

const SCROLL = "Library/Story.md";
const planner = createDumdictPlanner("de");

const noun = (canonicalForm: string, gender: "Masc" | "Fem" | "Neut") =>
	unit({
		canonicalForm,
		coreFeatures: { gender },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	} as Dumling.Lemma<"de">);
const readingOf = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;

const see = noun("See", "Masc");
const lake = readingOf(see, "🌊");
const anfangen = unit({
	canonicalForm: "anfangen",
	coreFeatures: { hasSepPrefix: "an", lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de">);

const NOUN_EVIDENCE = { articleEvidence: null, valencyEvidence: [] };
const seeUnits: Unit[] = [
	{ route: { family: "Lexeme", kind: "NOUN", language: "de" }, segments: [2] },
];
const notePath = (reading: Dumling.Reading<"de">) =>
	readingNotePath(reading).path;
const linkTo = (path: string, shown: string) =>
	`[[${path.replace(/\.md$/u, "")}|${shown}]]`;

/** An observer over an in-memory Scroll, checking at once instead of after a quiet period. */
function observerOver(options: {
	readonly store: DumdictVaultStore;
	readonly vault: FakeVault;
	readonly scroll: () => string;
	readonly activity?: ScrollActivity;
	readonly cache?: SegmentationCache["Service"];
	readonly blockedBy?: () => string | undefined;
	/** When the Scroll was last written; after every note unless given. */
	readonly scrollModifiedAt?: () => number;
}) {
	const notices: string[] = [];
	const reads: string[] = [];
	const store: UnlinkStore = options.store;
	const observer = createUnlinkObserver({
		activity: options.activity ?? createScrollActivity(),
		...(options.blockedBy === undefined ? {} : { blockedBy: options.blockedBy }),
		cache: options.cache ?? memorySegmentationCache(),
		notify: (message) => notices.push(message),
		quietMs: 0,
		scrolls: {
			exists: (path) =>
				Effect.sync(() => options.vault.content(path) !== undefined),
			modifiedAt: (path) =>
				Effect.sync(() =>
					path === SCROLL
						? (options.scrollModifiedAt?.() ?? Number.MAX_SAFE_INTEGER)
						: options.vault.files.get(path)?.mtime,
				),
			read: (path) =>
				Effect.sync(() => {
					reads.push(path);
					return path === SCROLL ? options.scroll() : undefined;
				}),
			resolve: (linkpath) =>
				Effect.succeed(linkpath === "Story" ? SCROLL : undefined),
		},
		segmenterVersion: () => "test-segmenter",
		store: Effect.succeed(store),
	});
	return {
		/** The user's edit lands, VAM reports it, and the check runs. */
		edit: async (write: () => void) => {
			write();
			observer.modified([SCROLL]);
			await observer.whenIdle();
		},
		notices,
		observer,
		/** The Scrolls the observer read, in order. */
		reads,
		/** The plugin starts: the sweep runs and its checks end. */
		sweep: async () => {
			observer.sweep();
			await observer.whenIdle();
		},
	};
}

const refsOf = async (store: DumdictVaultStore, lemma: Dumling.Lemma<"de">) =>
	((await run(store.lemmaNote(lemma)))?.readings ?? []).flatMap(
		({ attestationLinks }) => attestationLinks.map(({ ref }) => ref),
	);

describe("unlink observer", () => {
	it("removes an occurrence whose link the user deleted, and the Reading with its last one", async () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const stub = stubDumgen({
			grammar: () => ({
				_tag: "Resolved",
				attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			}),
			reading: (input) =>
				input.candidates.includes("🌊")
					? { _tag: "Reuse", emojiDescription: "🌊" }
					: { _tag: "New", emojiDescription: "🌊" },
		});
		const harness = await resolutionHarness({
			content,
			dumgen: stub.dumgen,
			scrollPath: SCROLL,
		});
		for (const sentenceText of ["Der See ist tief.", "Der See ist kalt."])
			await harness.resolve(
				planFor({
					content: harness.scroll.content,
					scrollPath: SCROLL,
					sentenceText,
					units: seeUnits,
				}),
			);
		const link = linkTo(notePath(lake), "See");
		expect(harness.scroll.content).toBe(
			`Der ${link} ist tief. ^0\n\nDer ${link} ist kalt. ^1\n`,
		);
		expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
			"![[Story#^0|^",
			"![[Story#^1|^",
		]);
		const { edit, notices } = observerOver({
			scroll: () => harness.scroll.content,
			store: harness.store,
			vault: harness.vault,
		});

		// Typing elsewhere removes nothing.
		await edit(() => {
			harness.scroll.content += "\nNeu getippt.\n";
		});
		expect(await refsOf(harness.store, see)).toHaveLength(2);

		// The second block's link goes: its occurrence goes, the Reading stays.
		await edit(() => {
			harness.scroll.content = harness.scroll.content.replace(
				`Der ${link} ist kalt.`,
				"Der See ist kalt.",
			);
		});
		const left = await refsOf(harness.store, see);
		expect(left.map((ref) => ref.slice(0, 13))).toEqual(["![[Story#^0|^"]);
		expect(harness.vault.content(notePath(lake))).not.toContain("Story#^1");
		expect(notices).toEqual(["✓ Removed 1 occurrence you unlinked in Story"]);

		// The last link goes: the Reading, its Surface and its Lemma go with it.
		await edit(() => {
			harness.scroll.content = harness.scroll.content.replace(link, "See");
		});
		expect(await run(harness.store.lemmaNote(see))).toBeUndefined();
		expect(harness.vault.content(notePath(lake))).toBeUndefined();
		expect(harness.vault.content(lemmaNotePath(see).path)).toBeUndefined();
	});

	it("stays off while a dictionary reset runs, and checks once it has ended", async () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const { dumgen } = stubDumgen({
			grammar: () => ({
				_tag: "Resolved",
				attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			}),
			reading: (input) =>
				input.candidates.includes("🌊")
					? { _tag: "Reuse", emojiDescription: "🌊" }
					: { _tag: "New", emojiDescription: "🌊" },
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		for (const sentenceText of ["Der See ist tief.", "Der See ist kalt."])
			await harness.resolve(
				planFor({
					content: harness.scroll.content,
					scrollPath: SCROLL,
					sentenceText,
					units: seeUnits,
				}),
			);
		let resetRunning = true;
		const { observer } = observerOver({
			blockedBy: () => (resetRunning ? "A dictionary reset is running" : undefined),
			scroll: () => harness.scroll.content,
			store: harness.store,
			vault: harness.vault,
		});
		const link = linkTo(notePath(lake), "See");
		harness.scroll.content = harness.scroll.content.replace(
			`Der ${link} ist kalt.`,
			"Der See ist kalt.",
		);
		observer.modified([SCROLL]);
		const idle = observer.whenIdle();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(await refsOf(harness.store, see)).toHaveLength(2);
		resetRunning = false;
		await idle;
		expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
			"![[Story#^0|^",
		]);
	});

	it("leaves moved text, a lost block ID and another Scroll's refs alone", async () => {
		const content = "Der See ist tief. ^0\n\nAnderes. ^1\n";
		const { dumgen } = stubDumgen({
			grammar: () => ({
				_tag: "Resolved",
				attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			}),
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		const link = linkTo(notePath(lake), "See");
		const { edit } = observerOver({
			scroll: () => harness.scroll.content,
			store: harness.store,
			vault: harness.vault,
		});

		// The sentence moved into block ^1.
		await edit(() => {
			harness.scroll.content = `Ganz neu. ^0\n\nAnderes. Der ${link} ist tief. ^1\n`;
		});
		expect(await refsOf(harness.store, see)).toHaveLength(1);
		// Block ^0 lost its ID, its link still there.
		await edit(() => {
			harness.scroll.content = `Der ${link} ist tief.\n\nAnderes. ^1\n`;
		});
		expect(await refsOf(harness.store, see)).toHaveLength(1);
		// None of the refs' blocks is in the file: not their Scroll.
		await edit(() => {
			harness.scroll.content = "Ein anderer Text.\n";
		});
		expect(await refsOf(harness.store, see)).toHaveLength(1);
	});

	it("waits for a Classify run on the Scroll to end before it judges", async () => {
		const content = "Der See ist tief. ^0\n";
		const { dumgen } = stubDumgen({
			grammar: () => ({
				_tag: "Resolved",
				attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			}),
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		const activity = createScrollActivity();
		const { observer } = observerOver({
			activity,
			scroll: () => harness.scroll.content,
			store: harness.store,
			vault: harness.vault,
		});
		const end = activity.begin(SCROLL);
		harness.scroll.content = "Der See ist tief. ^0\n";
		observer.modified([SCROLL]);
		const idle = observer.whenIdle();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await refsOf(harness.store, see)).toHaveLength(1);
		end();
		await idle;
		expect(await refsOf(harness.store, see)).toHaveLength(0);
	});

	it("tells a repeated Sentence's instances apart by their recomputed occurrence keys", async () => {
		const content = "Er fängt heute an. Er fängt heute an.\n";
		const stub = stubDumgen({
			grammar: (input) =>
				input.unit.route !== "Unresolved" && input.unit.route.kind === "VERB"
					? {
							_tag: "Resolved",
							attestation: attestationOf(anfangen, "fängt an", ["fängt", "an"], {
								expletiveEvidence: null,
								valencyEvidence: [],
							}),
						}
					: { _tag: "Unresolved" },
			reading: () => ({ _tag: "New", emojiDescription: "🏁" }),
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		const cache = memorySegmentationCache();
		const segmenter = createDumgen({
			jev: createScriptedJev(FAENGT_AN_ANSWERS).ask,
			luna: () => Promise.reject(new Error("segmentation asked Luna")),
		});
		const resolver = dumgenUnitResolver({
			dumgen: Effect.succeed(stub.dumgen),
			knowledge: harness.queue,
			scroll: harness.scroll,
			store: Effect.succeed(harness.store),
		});
		const outcome = await run(
			classifySelection({
				content,
				scrollPath: SCROLL,
				selection: selectionOf(content, content.trim()),
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						Layer.succeed(SegmentationCache, cache),
						Layer.succeed(UnitResolver, resolver),
						Layer.succeed(ClassifySegmenter, {
							dumgen: Effect.succeed(segmenter),
							segmenterVersion: "test-segmenter",
						}),
					),
				),
			),
		);
		await harness.queue.whenIdle();
		const verb = outcome.resolutions.find(({ _tag }) => _tag === "Resolved");
		if (verb?._tag !== "Resolved") throw new Error("anfangen did not resolve");
		const link = (shown: string) => linkTo(verb.readingPath, shown);
		const linked = `Er ${link("fängt")} heute ${link("an")}.`;
		expect(harness.scroll.content).toBe(`${linked} ${linked} ^0\n`);
		// Each instance is an occurrence of its own, judged once for both.
		const refs = await refsOf(harness.store, anfangen);
		expect(refs).toHaveLength(2);
		expect(new Set(refs).size).toBe(2);
		expect(stub.calls.grammar).toHaveLength(3);
		expect(stub.calls.reading).toHaveLength(1);

		const { edit } = observerOver({
			cache,
			scroll: () => harness.scroll.content,
			store: harness.store,
			vault: harness.vault,
		});
		// An edit to the first instance's Sentence: its key cannot be told,
		// so nothing goes.
		await edit(() => {
			harness.scroll.content = `Er ${link("fängt")} morgen ${link("an")}. Er fängt heute an. ^0\n`;
		});
		expect(await refsOf(harness.store, anfangen)).toEqual(refs);
		// The second instance's links go, the first's stay: only the second goes.
		await edit(() => {
			harness.scroll.content = `${linked} Er fängt heute an. ^0\n`;
		});
		const first = outcome.plan.units.find(
			({ instance, unit: { route } }) =>
				instance === 0 && route !== "Unresolved" && route.kind === "VERB",
		);
		if (!first) throw new Error("no first instance of anfangen");
		expect(await refsOf(harness.store, anfangen)).toEqual([
			`![[Story#^0|^${occurrenceKeyOf(first.ref, 0)}]]`,
		]);
	});

	it("re-evaluates the Shadows a removed Lemma leaves, after its removal lands", async () => {
		const derSee = noun("See", "Masc");
		const dieSee = noun("See", "Fem");
		const teich = noun("Teich", "Masc");
		const derSeeReading = readingOf(derSee, "💧");
		const dieSeeReading = readingOf(dieSee, "🚢");
		const teichReading = readingOf(teich, "🦆");
		const { store, vault } = await openStore();
		await seed(store, [
			createLemma(teich),
			createReading(readingEntry(teichReading)),
			{
				preconditions: [],
				record: createPendingSemanticRelationRecord(teichReading, {
					relation: "hypernym",
					target: { canonicalForm: "See", family: "Lexeme", kind: "NOUN", language: "de" },
				}),
				type: "createPendingSemanticRelation",
			},
			createLemma(derSee),
			createReading(readingEntry(derSeeReading)),
			createLemma(dieSee),
			createReading(readingEntry(dieSeeReading)),
		]);
		for (const [ref, reading] of [
			["![[Story#^0|^00000000]]", derSeeReading],
			["![[Story#^1|^11111111]]", dieSeeReading],
		] as const) {
			const surface = attestationOf(reading.lemma, "See", ["See"], NOUN_EVIDENCE).surface;
			const request = { link: { reading, ref, surfaceId: makeSurfaceId("de", surface) }, surface };
			const context = await run(
				store.loadReadingEntryContext(planner.contextRequest({ intent: "recordOccurrence", request })),
			);
			if (context.intent !== "recordOccurrence") throw new Error("Expected recordOccurrence");
			const outcome = planner.recordOccurrence(context, request);
			if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
			await run(store.commitChanges(outcome.plan));
		}
		const teichNote = notePath(teichReading);
		const derSeeLemmaLink = linkTo(lemmaNotePath(derSee).path, "See");
		// Two Lemmas fit Teich's Shadow, so it links the Crossroad.
		expect(vault.content(teichNote)).not.toContain(derSeeLemmaLink);

		let scroll = `Der ${linkTo(notePath(derSeeReading), "See")}. ^0\n\nDie ${linkTo(notePath(dieSeeReading), "See")}. ^1\n`;
		const { edit } = observerOver({ scroll: () => scroll, store, vault });
		await edit(() => {
			scroll = scroll.replace(linkTo(notePath(dieSeeReading), "See"), "See");
		});
		expect(await run(store.lemmaNote(dieSee))).toBeUndefined();
		// die See is gone, so der See alone fits the Shadow: Teich links it.
		expect(vault.content(teichNote)).toContain(derSeeLemmaLink);
		expect((await run(store.lemmaNote(teich)))?.readings[0]?.knowledge).toEqual({
			semanticRelations: { hypernym: [derSee] },
		});
	});
	describe("startup sweep", () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const link = linkTo(notePath(lake), "See");
		/** A Scroll Classify linked See in, twice. */
		const classified = async () => {
			const { dumgen } = stubDumgen({
				grammar: () => ({
					_tag: "Resolved",
					attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
				}),
				reading: (input) =>
					input.candidates.includes("🌊")
						? { _tag: "Reuse", emojiDescription: "🌊" }
						: { _tag: "New", emojiDescription: "🌊" },
			});
			const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
			for (const sentenceText of ["Der See ist tief.", "Der See ist kalt."])
				await harness.resolve(
					planFor({
						content: harness.scroll.content,
						scrollPath: SCROLL,
						sentenceText,
						units: seeUnits,
					}),
				);
			expect(harness.scroll.content).toBe(
				`Der ${link} ist tief. ^0\n\nDer ${link} ist kalt. ^1\n`,
			);
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			return harness;
		};
		/** The user unlinks the second See while the plugin is not running. */
		const unlinkOffline = (harness: Awaited<ReturnType<typeof classified>>) => {
			harness.scroll.content = harness.scroll.content.replace(
				`Der ${link} ist kalt.`,
				"Der See ist kalt.",
			);
		};

		it("removes an occurrence whose link went while the plugin was not running, and again removes nothing", async () => {
			const harness = await classified();
			unlinkOffline(harness);
			const { notices, sweep } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			await sweep();
			expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
				"![[Story#^0|^",
			]);
			expect(harness.vault.content(notePath(lake))).not.toContain("Story#^1");
			expect(notices).toEqual(["✓ Removed 1 occurrence you unlinked in Story"]);

			// A second sweep finds nothing left to remove and writes nothing.
			const notes = new Map(
				harness.vault.markdownPaths().map((path) => [path, harness.vault.content(path)]),
			);
			const batches = harness.vault.batches.length;
			await sweep();
			expect(await refsOf(harness.store, see)).toHaveLength(1);
			expect(harness.vault.batches).toHaveLength(batches);
			expect(
				new Map(
					harness.vault.markdownPaths().map((path) => [path, harness.vault.content(path)]),
				),
			).toEqual(notes);
			expect(notices).toHaveLength(1);
		});

		it("leaves an occurrence whose link is still there alone", async () => {
			const harness = await classified();
			const batches = harness.vault.batches.length;
			const { notices, sweep } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			await sweep();
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(harness.vault.batches).toHaveLength(batches);
			expect(notices).toEqual([]);
		});

		it("leaves refs newer than their Scroll alone until the Scroll is modified", async () => {
			const harness = await classified();
			unlinkOffline(harness);
			// The Scroll on disk is older than the notes that hold its refs, as
			// when the dictionary synced ahead of it.
			const { edit, sweep } = observerOver({
				scroll: () => harness.scroll.content,
				scrollModifiedAt: () => 0,
				store: harness.store,
				vault: harness.vault,
			});
			await sweep();
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			// A modification is judged in full.
			await edit(() => undefined);
			expect(await refsOf(harness.store, see)).toHaveLength(1);
		});

		it("checks a Scroll once when it is modified while the sweep runs", async () => {
			const harness = await classified();
			unlinkOffline(harness);
			const { notices, observer, reads } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			observer.sweep();
			observer.modified([SCROLL]);
			await observer.whenIdle();
			expect(reads).toEqual([SCROLL]);
			expect(await refsOf(harness.store, see)).toHaveLength(1);
			expect(notices).toEqual(["✓ Removed 1 occurrence you unlinked in Story"]);
		});
			it("judges every Scroll by the notes as they were before the sweep wrote", async () => {
			const { store, vault } = await openStore();
			await seed(store, [createLemma(see), createReading(readingEntry(lake))]);
			const surface = attestationOf(see, "See", ["See"], NOUN_EVIDENCE).surface;
			for (const ref of ["![[Story#^0|^00000000]]", "![[Tale#^0|^11111111]]"]) {
				const request = { link: { reading: lake, ref, surfaceId: makeSurfaceId("de", surface) }, surface };
				const context = await run(
					store.loadReadingEntryContext(planner.contextRequest({ intent: "recordOccurrence", request })),
				);
				if (context.intent !== "recordOccurrence") throw new Error("Expected recordOccurrence");
				const outcome = planner.recordOccurrence(context, request);
				if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
				await run(store.commitChanges(outcome.plan));
			}
			// Both Scrolls lost their link to the lake while the plugin was off.
			const scrolls: Record<string, string> = {
				"Library/Story.md": "Der See ist tief. ^0\n",
				"Library/Tale.md": "Der See ist kalt. ^0\n",
			};
			// After every note was written, and before the sweep's writes.
			const editedAt = Math.max(...[...vault.files.values()].map(({ mtime }) => mtime)) + 0.5;
			const notices: string[] = [];
			const observer = createUnlinkObserver({
				activity: createScrollActivity(),
				cache: memorySegmentationCache(),
				notify: (message) => notices.push(message),
				quietMs: 0,
				scrolls: {
					exists: (path) => Effect.sync(() => vault.content(path) !== undefined),
					modifiedAt: (path) =>
						Effect.sync(() =>
							path in scrolls ? editedAt : vault.files.get(path)?.mtime,
						),
					read: (path) => Effect.sync(() => scrolls[path]),
					resolve: (linkpath) => Effect.succeed(`Library/${linkpath}.md`),
				},
				segmenterVersion: () => "test-segmenter",
				store: Effect.succeed(store),
			});
			observer.sweep();
			await observer.whenIdle();
			// Story's removal rewrote the lake's note; Tale's ref went too.
			expect(await run(store.lemmaNote(see))).toBeUndefined();
			expect(notices).toEqual([
				"✓ Removed 1 occurrence you unlinked in Story",
				"✓ Removed 1 occurrence you unlinked in Tale",
			]);
		});
	});
});
