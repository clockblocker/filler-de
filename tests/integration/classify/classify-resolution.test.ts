/**
 * The `classify-resolution` desktop scenario's story without Obsidian: the
 * plugin's dumgen service with the scenario's script, the real resolver, the
 * dictionary store over a fake vault and the Scroll in memory. It proves
 * the scripted dumgen resolves the noun, the separable verb and the
 * Locution through the real dumgen, so the desktop scenario tests the
 * Obsidian side only. Its last step is the `classify-unlink` scenario's:
 * the user unlinks two occurrences and the unlink observer removes them.
 * The `classify-sentence-blocks` scenario's story follows: a paragraph of
 * several Sentences without IDs, cut into sentence blocks first.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import { type Answer, operations } from "dumgen";
import { Effect } from "effect";
import { ClassifyCommander } from "../../../src/commanders/classify/classify-commander";
import { dumgenUnitResolver } from "../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { makeKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import { produceKnowledge } from "../../../src/commanders/classify/resolution/produce-knowledge";
import { createScrollActivity } from "../../../src/commanders/classify/resolution/scroll-activity";
import { makeUnlinkObserver } from "../../../src/commanders/classify/resolution/unlink-observer";
import { memorySegmentationCache } from "../../../src/commanders/classify/segmentation-cache";
import { FakeVault } from "../../../src/packages/composed/dictionary/tests/support/fake-vault";
import { dictionaryProjections } from "../../../src/stateless-helpers/dictionary-projections";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	CROSSROAD_PATHS,
	expectFirstClassifyNotes,
	FIRST_SELECTION,
	LEMMA_PATHS,
	SECOND_SELECTION,
	SENTENCE_BLOCKS_SELECTION,
	SENTENCE_BLOCKS_STORY,
	STORY,
	sentenceBlocksStory,
} from "../../obsidian-e2e/scenarios/classify-resolution-script";
import { TITLES, visible } from "../../obsidian-e2e/scenarios/dictionary-layout";
import { inScope } from "../../support/scoped";
import { MemoryScroll, resolveAmong } from "../../unit/classify/resolution/support";
import { dumgenServiceOver, unreachable } from "../../unit/dumgen/dumgen-support";

const SCROLL = "Library/Story.md";

/** The driver's expansion of a scenario's jev script into dumgen Answers. */
function answersOf(
	script: Readonly<Record<string, string | number>>,
): Record<string, Answer> {
	return Object.fromEntries(
		Object.entries(script).map(([id, answer]) => [
			id,
			typeof answer === "number"
				? { noul: answer, type: "noul" }
				: {
						choice: answer,
						confidence: 1,
						probabilities: { [answer]: 1 },
						type: "choice",
					},
		]),
	);
}

const KNOWLEDGE_STAGES = ["transcription", "definition", "translations"];

/** The dictionary's notes by vault path, as the driver's `dictionary` reads them. */
/** The dictionary's notes, by path. */
const notesOf = (vault: FakeVault) =>
	Object.fromEntries(
		vault
			.markdownPaths()
			.filter((path) => path.startsWith("Worter/"))
			.map((path) => [path, vault.content(path)]),
	);

/** The plugin's Classify over `story`, held in memory, with the scenario's script. */
async function classifyHarness(story: string) {
	const dumgen = dumgenServiceOver(unreachable, () => ({
		openaiApiKey: "",
		typesafeApiKey: "",
	}));
	Effect.runSync(
		dumgen.testing.useScripted({
		jev: answersOf(CLASSIFY_RESOLUTION_DUMGEN.jev),
		luna: CLASSIFY_RESOLUTION_DUMGEN.luna,
		}),
	);
	// Obsidian knows the Scroll, so refs name it by its basename.
	const vault = new FakeVault({ [SCROLL]: story });
	const store = await Effect.runPromise(
		makeDumdictVaultStore({ projections: dictionaryProjections, vault }),
	);
	const scroll = new MemoryScroll(SCROLL, story);
	const notices: string[] = [];
	const { value: queue } = await inScope(
		makeKnowledgeQueue({
			notify: (message) => notices.push(message),
			run: (job) =>
				produceKnowledge(
					{ dumgen: operations, store, translationLanguages: ["en", "ru"] },
					job,
				).pipe(dumgen.provideBackground),
		}),
	);
	const cache = memorySegmentationCache();
	const activity = createScrollActivity();
	const commander = new ClassifyCommander({
		cache,
		dumgen: dumgen.provide,
		missingProviderKeys: dumgen.missingKeys,
		resolver: dumgenUnitResolver({
			activity,
			dumgen: operations,
			knowledge: queue,
			notify: (message) => notices.push(message),
			scroll,
			store: Effect.succeed(store),
		}),
		segmenterVersion: Effect.succeed("test-segmenter"),
	});
	const classify = async (selection: string) => {
		const from = scroll.content.indexOf(selection);
		await Effect.runPromise(
			commander.execute(
				{
					content: scroll.content,
					scrollPath: SCROLL,
					selection: { from, to: from + selection.length },
				},
				(message) => notices.push(message),
			),
		);
		await Effect.runPromise(queue.whenIdle);
	};
	/** The Reading note of the one Reading of the Lemma note at `path`. */
	const readingNoteOf = async (path: string) => {
		const note = await Effect.runPromise(store.lemmaNotes);
		const lemma = note.find((entry) => entry.path === path)?.lemma;
		if (!lemma) throw new Error(`No Lemma note at ${path}`);
		const stored = await Effect.runPromise(store.lemmaNote(lemma));
		const reading = stored?.readings[0]?.reading;
		if (!reading) throw new Error(`No Reading at ${path}`);
		const location = await Effect.runPromise(store.readingLocation(reading));
		if (!location) throw new Error(`No Reading note for ${path}`);
		return location.path;
	};
	const link = async (path: string, shown: string) =>
		`[[${(await readingNoteOf(path)).slice(0, -3)}|${shown}]]`;
	return {
		activity,
		cache,
		classify,
		commander,
		dumgen,
		link,
		readingNoteOf,
		scroll,
		store,
		vault,
	};
}

describe("Classify resolves a selection end to end", () => {
	it("links the noun, the separable verb and the Locution, then re-encounters the noun without Knowledge calls", async () => {
		const {
			activity,
			cache,
			classify,
			commander,
			dumgen,
			link,
			readingNoteOf,
			scroll,
			store,
			vault,
		} = await classifyHarness(STORY);
		await classify(FIRST_SELECTION);
		const first = commander.latestHandoff();
		expect(first?.resolutions).toEqual([
			"Resolved",
			"Resolved",
			"Resolved",
			"Resolved",
		]);
		expect(scroll.content).toBe(
			`${await link(LEMMA_PATHS.hund, "Der Hund")} ${await link(LEMMA_PATHS.anfangen, "fängt")} ${await link(LEMMA_PATHS.heute, "heute")} ${await link(LEMMA_PATHS.aufJedenFall, "auf jeden Fall")} ${await link(LEMMA_PATHS.anfangen, "an")}. ^0\n\nDer Hund schläft. ^1\n`,
		);
		const readingPaths = [];
		for (const path of [
			LEMMA_PATHS.hund,
			LEMMA_PATHS.anfangen,
			LEMMA_PATHS.heute,
			LEMMA_PATHS.aufJedenFall,
		])
			readingPaths.push(await readingNoteOf(path));
		expectFirstClassifyNotes(notesOf(vault), readingPaths);
		const afterFirst = notesOf(vault);
		const knowledgeCalls = () =>
			KNOWLEDGE_STAGES.map(
				(stage) => Effect.runSync(dumgen.testing.requests)?.luna[stage] ?? 0,
			);
		const before = knowledgeCalls();
		expect(before.every((count) => count > 0)).toBe(true);

		await classify(SECOND_SELECTION);
		const hund = commander.latestHandoff()?.resolved[0];
		expect(hund).toMatchObject({
			linked: 1,
			readingPath: await readingNoteOf(LEMMA_PATHS.hund),
		});
		expect(vault.content(await readingNoteOf(LEMMA_PATHS.hund))).toMatch(
			/!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u,
		);
		expect(knowledgeCalls()).toEqual(before);
		// The same Surface again: the Lemma note and the Crossroad stay.
		expect(vault.content(LEMMA_PATHS.hund)).toBe(afterFirst[LEMMA_PATHS.hund]);
		expect(vault.content(CROSSROAD_PATHS.hund)).toBe(
			afterFirst[CROSSROAD_PATHS.hund],
		);

		// The user unlinks the second "Der Hund" and "heute" (#116).
		const hundNote = await readingNoteOf(LEMMA_PATHS.hund);
		const heuteNote = await readingNoteOf(LEMMA_PATHS.heute);
		const { value: observer } = await inScope(
			makeUnlinkObserver({
				activity,
				cache,
				quietMs: 0,
				scrolls: {
					modifiedAt: () => Effect.succeed(undefined),
					read: (path) =>
						Effect.sync(() => (path === SCROLL ? scroll.content : undefined)),
					resolve: resolveAmong(() => [...vault.markdownPaths(), SCROLL]),
				},
				segmenterVersion: Effect.succeed("test-segmenter"),
				store: Effect.succeed(store),
			}),
		);
		scroll.content = scroll.content
			.replace(`${await link(LEMMA_PATHS.hund, "Der Hund")} schläft.`, "Der Hund schläft.")
			.replace(await link(LEMMA_PATHS.heute, "heute"), "heute");
		await Effect.runPromise(observer.modified([SCROLL]));
		await Effect.runPromise(observer.whenIdle);
		expect(vault.content(hundNote)).toMatch(/!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]/u);
		expect(vault.content(hundNote)).not.toMatch(/Story#\^1/u);
		expect(vault.content(heuteNote)).toBeUndefined();
		expect(vault.content(LEMMA_PATHS.heute)).toBeUndefined();
		expect(vault.content(LEMMA_PATHS.anfangen)).toBeDefined();
		// heute's Crossroad stays, saying it is not classified yet.
		expect(visible(vault.content(CROSSROAD_PATHS.heute))).toBe(
			`${TITLES.eintraege}\n*Not classified yet*`,
		);
	});

	it("cuts a paragraph of several Sentences into sentence blocks, so the Attestation embeds its own Sentence", async () => {
		const {
			activity,
			cache,
			classify,
			commander,
			link,
			readingNoteOf,
			scroll,
			store,
			vault,
		} = await classifyHarness(SENTENCE_BLOCKS_STORY);
		await classify(SENTENCE_BLOCKS_SELECTION);
		const hund = commander.latestHandoff()?.resolved[0];
		const hundNote = await readingNoteOf(LEMMA_PATHS.hund);
		expect(hund).toMatchObject({ linked: 1, readingPath: hundNote });
		const derHund = await link(LEMMA_PATHS.hund, "Der Hund");
		const cut = sentenceBlocksStory(derHund);
		expect(scroll.content).toBe(cut);
		const refs = () => vault.content(hundNote)?.match(/!\[\[Story#\^\d+\|/gu);
		expect(refs()).toEqual(["![[Story#^1|"]);

		// The user unlinks Der Hund: its block links nothing, so it goes.
		const { value: observer } = await inScope(
			makeUnlinkObserver({
				activity,
				cache,
				quietMs: 0,
				scrolls: {
					modifiedAt: () => Effect.succeed(undefined),
					read: (path) =>
						Effect.sync(() => (path === SCROLL ? scroll.content : undefined)),
					resolve: resolveAmong(() => [...vault.markdownPaths(), SCROLL]),
				},
				segmenterVersion: Effect.succeed("test-segmenter"),
				store: Effect.succeed(store),
			}),
		);
		scroll.content = cut.replace(derHund, "Der Hund");
		await Effect.runPromise(observer.modified([SCROLL]));
		await Effect.runPromise(observer.whenIdle);
		expect(vault.content(hundNote)).toBeUndefined();
		expect(vault.content(LEMMA_PATHS.hund)).toBeUndefined();

		// Classify again: the block keeps its ID, nothing is cut again, and
		// the Attestation names the same Sentence.
		await classify(SENTENCE_BLOCKS_SELECTION);
		const again = await readingNoteOf(LEMMA_PATHS.hund);
		expect(scroll.content).toBe(
			sentenceBlocksStory(await link(LEMMA_PATHS.hund, "Der Hund")),
		);
		expect(vault.content(again)?.match(/!\[\[Story#\^\d+\|/gu)).toEqual([
			"![[Story#^1|",
		]);
	});
});
