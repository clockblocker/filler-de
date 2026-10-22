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
import { sentenceKey } from "../../../../src/commanders/classify/sentence-key";
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
	resolveAmong,
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
const SEGMENTER_VERSION = "test-segmenter";

/** Classify linked See in each of `sentences`, caching their segmentation as it does. */
async function classifiedSee(content: string, sentences: readonly string[]) {
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
	const cache = memorySegmentationCache();
	for (const sentenceText of sentences) {
		const key = sentenceKey(SEGMENTER_VERSION, "de", sentenceText);
		const plan = planFor({
			content: harness.scroll.content,
			scrollPath: SCROLL,
			sentenceKey: key,
			sentenceText,
			units: seeUnits,
		});
		const segmented = plan.sentences.get(key)?.segmented;
		if (!segmented) throw new Error(`no plan for ${sentenceText}`);
		await run(cache.put(key, segmented));
		await harness.resolve(plan);
	}
	return { cache, harness };
}

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
	readonly sweepQuietMs?: number;
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
		...(options.sweepQuietMs === undefined ? {} : { sweepQuietMs: options.sweepQuietMs }),
		scrolls: {
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
			resolve: resolveAmong(() => [...options.vault.markdownPaths(), SCROLL]),
		},
		segmenterVersion: () => SEGMENTER_VERSION,
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
		const { cache, harness } = await classifiedSee(content, [
			"Der See ist tief.",
			"Der See ist kalt.",
		]);
		const link = linkTo(notePath(lake), "See");
		expect(harness.scroll.content).toBe(
			`Der ${link} ist tief. ^0\n\nDer ${link} ist kalt. ^1\n`,
		);
		expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
			"![[Story#^0|^",
			"![[Story#^1|^",
		]);
		const { edit, notices } = observerOver({
			cache,
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

		// The last link goes: the Scroll still holds the Sentence it was
		// recorded in, so the Reading, its Surface and its Lemma go with it.
		await edit(() => {
			harness.scroll.content = harness.scroll.content.replace(link, "See");
		});
		expect(await run(harness.store.lemmaNote(see))).toBeUndefined();
		expect(harness.vault.content(notePath(lake))).toBeUndefined();
		expect(harness.vault.content(lemmaNotePath(see).path)).toBeUndefined();
	});

	describe("the same Scroll", () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const link = linkTo(notePath(lake), "See");
		const linked = async () => {
			const { cache, harness } = await classifiedSee(content, [
				"Der See ist tief.",
				"Der See ist kalt.",
			]);
			expect(harness.scroll.content).toBe(
				`Der ${link} ist tief. ^0\n\nDer ${link} ist kalt. ^1\n`,
			);
			const observed = observerOver({
				cache,
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			return { ...observed, harness };
		};

		it("leaves another file at the Scroll's path alone, though it numbers its blocks as the Scroll did", async () => {
			const { edit, harness, notices } = await linked();
			// The Scroll was renamed without its refs, and another classified
			// file took its name: its blocks are ^0 and ^1 too.
			await edit(() => {
				harness.scroll.content = `Ein ganz anderer Text. ^0\n\nMit eigenen ${linkTo("Worter/de/x/Block", "Blöcken")}. ^1\n`;
			});
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
		});

		it("leaves an occurrence alone whose block was cut out of the Scroll", async () => {
			const { edit, harness, notices } = await linked();
			// The second paragraph was cut, as to paste it elsewhere.
			await edit(() => {
				harness.scroll.content = `Der ${link} ist tief. ^0\n`;
			});
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
			// A link removed from a block the Scroll still holds goes.
			await edit(() => {
				harness.scroll.content = "Der See ist tief. ^0\n";
			});
			expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
				"![[Story#^1|^",
			]);
		});

		it("judges only the occurrence whose Sentence another file at the Scroll's path happens to hold", async () => {
			const { edit, harness } = await linked();
			// Another file took the Scroll's name. Its first block holds the
			// same Sentence, unlinked; its second does not.
			await edit(() => {
				harness.scroll.content = "Der See ist tief. ^0\n\nEin ganz anderer Text. ^1\n";
			});
			expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
				"![[Story#^1|^",
			]);
		});

		it("removes the Scroll's last link only while it holds the Sentence that link was recorded in", async () => {
			const { edit, harness } = await linked();
			await edit(() => {
				harness.scroll.content = harness.scroll.content.replace(
					`Der ${link} ist kalt.`,
					"Der See ist sehr kalt.",
				);
			});
			// The last link goes with an edit to its Sentence: nothing tells
			// this is still the Scroll, so it stays.
			await edit(() => {
				harness.scroll.content = "Der See ist sehr tief. ^0\n\nDer See ist sehr kalt. ^1\n";
			});
			expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
				"![[Story#^0|^",
			]);
		});
	});

	describe("links as Obsidian resolves them", () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const path = notePath(lake).replace(/\.md$/u, "");
		const name = path.split("/").at(-1) ?? path;
		const linked = async () => {
			const { cache, harness } = await classifiedSee(content, [
				"Der See ist tief.",
				"Der See ist kalt.",
			]);
			const observed = observerOver({
				cache,
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			return { ...observed, harness };
		};

		it("counts a link Obsidian rewrote to the shortest path as still linking, until the user removes it", async () => {
			const { edit, harness, notices } = await linked();
			// Obsidian's link updater, set to the shortest path, rewrote both.
			await edit(() => {
				harness.scroll.content = `Der [[${name}|See]] ist tief. ^0\n\nDer [[${name}|See]] ist kalt. ^1\n`;
			});
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
			await edit(() => {
				harness.scroll.content = `Der [[${name}|See]] ist tief. ^0\n\nDer See ist kalt. ^1\n`;
			});
			expect((await refsOf(harness.store, see)).map((ref) => ref.slice(0, 13))).toEqual([
				"![[Story#^0|^",
			]);
			expect(notices).toEqual(["✓ Removed 1 occurrence you unlinked in Story"]);
		});

		it("counts another case, a heading, a block, `.md`, an escaped pipe and an embed as still linking", async () => {
			const { edit, harness, notices } = await linked();
			for (const written of [
				`[[${path.toLowerCase()}|See]]`,
				`[[${name.toUpperCase()}|See]]`,
				`[[${path}#Kontexte|See]]`,
				`[[${name}#^abc|See]]`,
				`[[${path}.md|See]]`,
				`[[${path}\\|See]]`,
				`[[ ${path} |See]]`,
				`![[${path}]]`,
			]) {
				await edit(() => {
					harness.scroll.content = `Der ${linkTo(notePath(lake), "See")} ist tief. ^0\n\nDer ${written} ist kalt. ^1\n`;
				});
				expect(await refsOf(harness.store, see)).toHaveLength(2);
			}
			expect(notices).toEqual([]);
		});

		it("leaves a block alone whose link resolves to no note", async () => {
			const { edit, harness, notices } = await linked();
			// The Reading note was renamed, and Obsidian has not rewritten its
			// shortest link yet.
			await edit(() => {
				harness.scroll.content = `Der ${linkTo(notePath(lake), "See")} ist tief. ^0\n\nDer [[${name} alt|See]] ist kalt. ^1\n`;
			});
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
		});
	});

	it("waits for Sync to stop bringing dictionary notes before it judges, so the Scroll catches up first", async () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const { cache, harness } = await classifiedSee(content, [
			"Der See ist tief.",
			"Der See ist kalt.",
		]);
		const linkedScroll = harness.scroll.content;
		const link = linkTo(notePath(lake), "See");
		const { observer } = observerOver({
			cache,
			scroll: () => harness.scroll.content,
			store: harness.store,
			sweepQuietMs: 150,
			vault: harness.vault,
		});
		// Sync brought the lake's note with a ref another device recorded, and
		// the user edits the Scroll before its links arrive.
		observer.modified([notePath(lake)]);
		harness.scroll.content = linkedScroll.replace(`Der ${link} ist kalt.`, "Der See ist kalt.");
		observer.modified([SCROLL]);
		await Bun.sleep(50);
		expect(await refsOf(harness.store, see)).toHaveLength(2);
		// The Scroll lands.
		harness.scroll.content = linkedScroll;
		observer.modified([SCROLL]);
		await observer.whenIdle();
		expect(await refsOf(harness.store, see)).toHaveLength(2);
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
		const { cache, harness } = await classifiedSee(content, ["Der See ist tief."]);
		const activity = createScrollActivity();
		const { observer } = observerOver({
			activity,
			cache,
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

	it("removes nothing when a Classify run starts after the check read the Scroll, and judges again once it ends", async () => {
		const content = "Der See ist tief. ^0\n";
		const { cache, harness } = await classifiedSee(content, ["Der See ist tief."]);
		const activity = createScrollActivity();
		let end: (() => void) | undefined;
		const { observer } = observerOver({
			activity,
			cache,
			// The run begins while the check judges, before its removal plans.
			scroll: () => {
				end ??= activity.begin(SCROLL);
				return harness.scroll.content;
			},
			store: harness.store,
			vault: harness.vault,
		});
		harness.scroll.content = "Der See ist tief. ^0\n";
		observer.modified([SCROLL]);
		const idle = observer.whenIdle();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(end).toBeDefined();
		expect(await refsOf(harness.store, see)).toHaveLength(1);
		end?.();
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
		it("leaves a Scroll that links none of its occurrences alone, as another file of its name", async () => {
			const harness = await classified();
			harness.scroll.content = content;
			const { edit, notices, sweep } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			await sweep();
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
			// An edit the plugin saw finds no more proof that this is the Scroll.
			await edit(() => undefined);
			expect(await refsOf(harness.store, see)).toHaveLength(2);
		});

		it("leaves an occurrence whose block is gone alone", async () => {
			const harness = await classified();
			harness.scroll.content = `Der ${link} ist tief. ^0\n`;
			const { edit, notices, sweep } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				vault: harness.vault,
			});
			await sweep();
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			expect(notices).toEqual([]);
			// Nor does an edit the plugin saw.
			await edit(() => undefined);
			expect(await refsOf(harness.store, see)).toHaveLength(2);
		});

		it("waits for the vault to be quiet before its checks", async () => {
			const harness = await classified();
			unlinkOffline(harness);
			const { observer } = observerOver({
				scroll: () => harness.scroll.content,
				store: harness.store,
				sweepQuietMs: 150,
				vault: harness.vault,
			});
			observer.sweep();
			// Sync writes a note elsewhere.
			observer.modified(["Worter/elsewhere.md"]);
			await Bun.sleep(50);
			expect(await refsOf(harness.store, see)).toHaveLength(2);
			await observer.whenIdle();
			expect(await refsOf(harness.store, see)).toHaveLength(1);
		});

		it("judges every Scroll by the notes as they were before the sweep wrote, and tells it in one notice", async () => {
			const { store, vault } = await openStore();
			await seed(store, [createLemma(see), createReading(readingEntry(lake))]);
			const surface = attestationOf(see, "See", ["See"], NOUN_EVIDENCE).surface;
			for (const ref of [
				"![[Story#^0|^00000000]]",
				"![[Story#^1|^22222222]]",
				"![[Tale#^0|^11111111]]",
				"![[Tale#^1|^33333333]]",
			]) {
				const request = { link: { reading: lake, ref, surfaceId: makeSurfaceId("de", surface) }, surface };
				const context = await run(
					store.loadReadingEntryContext(planner.contextRequest({ intent: "recordOccurrence", request })),
				);
				if (context.intent !== "recordOccurrence") throw new Error("Expected recordOccurrence");
				const outcome = planner.recordOccurrence(context, request);
				if (outcome.status !== "planned") throw new Error(JSON.stringify(outcome));
				await run(store.commitChanges(outcome.plan));
			}
			// Both Scrolls lost one link to the lake while the plugin was off.
			const scrolls: Record<string, string> = {
				"Library/Story.md": `Der See ist tief. ^0\n\nDer ${link} ist klar. ^1\n`,
				"Library/Tale.md": `Der See ist kalt. ^0\n\nDer ${link} ist still. ^1\n`,
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
					modifiedAt: (path) =>
						Effect.sync(() =>
							path in scrolls ? editedAt : vault.files.get(path)?.mtime,
						),
					read: (path) => Effect.sync(() => scrolls[path]),
					resolve: resolveAmong(() => [...vault.markdownPaths(), ...Object.keys(scrolls)]),
				},
				segmenterVersion: () => "test-segmenter",
				store: Effect.succeed(store),
			});
			observer.sweep();
			await observer.whenIdle();
			// Story's removal rewrote the lake's note; Tale's ref went too.
			expect(await refsOf(store, see)).toEqual([
				"![[Story#^1|^22222222]]",
				"![[Tale#^1|^33333333]]",
			]);
			expect(notices).toEqual(["✓ Removed 2 occurrences you unlinked in 2 Scrolls"]);
		});
	});
});
