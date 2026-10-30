/**
 * The `classify-breakdown` desktop scenarios' stories without Obsidian: the
 * plugin's dumgen service with each scenario's script, the real resolver
 * and Knowledge run, and the dictionary store over a fake vault. They prove
 * the scripts break each Reading down through the real dumgen and its
 * segmenters, so the desktop scenarios test the Obsidian side only.
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
import type { ScriptedLunaAnswers } from "../../../src/managers/dumgen/scripted-luna";
import { FakeVault } from "../../../src/packages/composed/dictionary/tests/support/fake-vault";
import { dictionaryProjections } from "../../../src/stateless-helpers/dictionary-projections";
import {
	breakdownRequests,
	COMPOUND_DUMGEN,
	COMPOUND_PATHS,
	COMPOUND_STORY,
	CONVERSION_DUMGEN,
	CONVERSION_PATHS,
	CONVERSION_SELECTIONS,
	CONVERSION_STORY,
	constituentsLine,
	expectMorphemeSection,
	formationLine,
	formationLines,
	morphemeLines,
	morphemesLine,
	PART_CROSSROADS,
	readingMetadata,
	SELECTIONS,
	SETTLED_DUMGEN,
	sourceLine,
} from "../../obsidian-e2e/scenarios/classify-breakdown-script";
import {
	expectHiddenMetadata,
	linkTo,
} from "../../obsidian-e2e/scenarios/dictionary-layout";
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

/** One scenario's Classify over a Scroll in memory and a fake vault. */
async function storyOf(
	story: string,
	script: {
		readonly jev: Readonly<Record<string, string | number>>;
		readonly luna: ScriptedLunaAnswers;
	},
) {
	const dumgen = dumgenServiceOver(unreachable, () => ({
		openaiApiKey: "",
		typesafeApiKey: "",
	}));
	Effect.runSync(
		dumgen.testing.useScripted({
			jev: answersOf(script.jev),
			luna: script.luna,
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
					{ dumgen: operations, store, translationLanguages: ["en"] },
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
	return {
		/** Classifies the selection, which occurs once, and waits for its Knowledge. */
		classify: async (selection: string) => {
			const from = scroll.content.indexOf(selection);
			expect(scroll.content.indexOf(selection, from + 1)).toBe(-1);
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
			return commander.latestHandoff()?.resolved;
		},
		/** The user edits the Scroll, and the unlink observer answers. */
		edit: async (content: string) => {
			scroll.content = content;
			await Effect.runPromise(observer.modified([SCROLL]));
			await Effect.runPromise(observer.whenIdle);
		},
		notes: (): Record<string, string | undefined> =>
			Object.fromEntries(
				vault
					.markdownPaths()
					.filter((path) => path.startsWith("Worter/"))
					.map((path) => [path, vault.content(path)]),
			),
		notices,
		requests: () =>
			breakdownRequests(Effect.runSync(dumgen.testing.requests)),
		scroll,
	};
}

const P = COMPOUND_PATHS;
const X = PART_CROSSROADS;

describe("Classify breaks each Reading down", () => {
	it("shows a compound's Breakdown, re-points it to a stored part, and back once the part goes", async () => {
		const story = await storyOf(COMPOUND_STORY, COMPOUND_DUMGEN);

		expect(await story.classify(SELECTIONS.kohlekraftwerk)).toEqual([
			{ linked: 1, readingPath: P.kohlekraftwerkReading },
		]);
		let notes = story.notes();
		expectHiddenMetadata(notes[P.kohlekraftwerkReading], "readingNote");
		// Kraftwerk is pending: a Crossroad link and an Unsplit chunk.
		const pending = [
			morphemesLine([X.kohle, "Kohle"], [X.kraftwerk, "kraftwerk"]),
			constituentsLine([X.kohle, "Kohle"], [X.kraftwerk, "Kraftwerk"]),
		];
		expectMorphemeSection(notes[P.kohlekraftwerkReading], pending);
		// A pending part's Crossroad note is not created for it.
		expect(notes[X.kraftwerk]).toBeUndefined();
		expect(formationLines(notes[P.kohlekraftwerkLemma])).toEqual([]);

		expect(await story.classify(SELECTIONS.kraftwerk)).toEqual([
			{ linked: 1, readingPath: P.kraftwerkReading },
		]);
		notes = story.notes();
		expectMorphemeSection(notes[P.kraftwerkReading], [
			morphemesLine([X.kraft, "Kraft"], [X.werk, "werk"]),
			constituentsLine([X.kraft, "Kraft"], [X.werk, "Werk"]),
		]);
		// Kohlekraftwerk's part now links Kraftwerk's Lemma note, and its
		// morphemes line splits through Kraftwerk's own Breakdown.
		const stored = [
			morphemesLine([X.kohle, "Kohle"], [X.kraft, "kraft"], [X.werk, "werk"]),
			constituentsLine([X.kohle, "Kohle"], [P.kraftwerkLemma, "Kraftwerk"]),
		];
		expectMorphemeSection(notes[P.kohlekraftwerkReading], stored);
		// Kraftwerk's Lemma note lists the word built on it (#269), linking
		// its Reading note.
		const formations = [
			formationLine("Komposita", [P.kohlekraftwerkReading, "Kohlekraftwerk"]),
		];
		expect(formationLines(notes[P.kraftwerkLemma])).toEqual(formations);
		const asked = story.requests();
		expect(asked["jev:breakdown-analysis"]).toBe(2);

		// A Reading that stores its Breakdown asks for none again.
		expect(await story.classify(SELECTIONS.kohlekraftwerkAgain)).toEqual([
			{ linked: 1, readingPath: P.kohlekraftwerkReading },
		]);
		expect(story.requests()).toEqual(asked);
		notes = story.notes();
		expectMorphemeSection(notes[P.kohlekraftwerkReading], stored);
		expect(formationLines(notes[P.kraftwerkLemma])).toEqual(formations);

		// The user unlinks Kraftwerk's only occurrence: its notes go, with its
		// Formations, and Kohlekraftwerk's part links its Crossroad again.
		const unlinked = story.scroll.content.replace(
			linkTo(P.kraftwerkReading, "Das Kraftwerk"),
			"Das Kraftwerk",
		);
		expect(unlinked).not.toBe(story.scroll.content);
		await story.edit(unlinked);
		notes = story.notes();
		expect(notes[P.kraftwerkReading]).toBeUndefined();
		expect(notes[P.kraftwerkLemma]).toBeUndefined();
		expect(formationLines(notes[P.kohlekraftwerkLemma])).toEqual([]);
		expectMorphemeSection(notes[P.kohlekraftwerkReading], pending);
	});

	it("shows a conversion's Source line, and re-points it to the base's Lemma note", async () => {
		const story = await storyOf(CONVERSION_STORY, CONVERSION_DUMGEN);
		const C = CONVERSION_PATHS;

		expect(await story.classify(CONVERSION_SELECTIONS.lauf)).toEqual([
			{ linked: 1, readingPath: C.laufReading },
		]);
		expectMorphemeSection(story.notes()[C.laufReading], [
			morphemesLine([X.laufen, "Lauf"]),
			sourceLine(X.laufen, "laufen"),
		]);
		const asked = story.requests();
		expect(asked).toMatchObject({
			"jev:breakdown-analysis": 0,
			"jev:sourceFormation": 1,
			"jev:sourceJudgment": 1,
			"luna:sourceBase": 1,
		});

		// A Reading that stores its Source asks for nothing again.
		expect(await story.classify(CONVERSION_SELECTIONS.laufAgain)).toEqual([
			{ linked: 1, readingPath: C.laufReading },
		]);
		expect(story.requests()).toEqual(asked);

		// laufen has no Source and no cut: a bottom word, split into morphemes.
		expect(await story.classify(CONVERSION_SELECTIONS.laufen)).toEqual([
			{ linked: 1, readingPath: C.laufenReading },
		]);
		const notes = story.notes();
		expectMorphemeSection(notes[C.laufenReading], [
			morphemesLine([X.lauf, "lauf"], [X.en, "en"]),
		]);
		// Lauf's Source now links laufen's Lemma note, and its morphemes
		// line walks laufen's.
		expectMorphemeSection(notes[C.laufReading], [
			morphemesLine([X.lauf, "Lauf"]),
			sourceLine(C.laufenLemma, "laufen"),
		]);
		// laufen's Lemma note lists Lauf as built from it (#269).
		expect(formationLines(notes[C.laufenLemma])).toEqual([
			formationLine("Grundform von", [C.laufReading, "Lauf"]),
		]);
	});

	it("settles a Reading whose Source is Unresolved, and asks it no more", async () => {
		const story = await storyOf(COMPOUND_STORY, SETTLED_DUMGEN);

		expect(await story.classify(SELECTIONS.kohlekraftwerk)).toEqual([
			{ linked: 1, readingPath: P.kohlekraftwerkReading },
		]);
		let note = story.notes()[P.kohlekraftwerkReading];
		expect(morphemeLines(note)).toBeUndefined();
		expect(readingMetadata(note).breakdownSettled).toBe("Unresolved");
		const asked = story.requests();
		expect(asked).toMatchObject({
			"jev:breakdown-analysis": 0,
			"jev:sourceFormation": 1,
		});

		expect(await story.classify(SELECTIONS.kohlekraftwerkAgain)).toEqual([
			{ linked: 1, readingPath: P.kohlekraftwerkReading },
		]);
		expect(story.requests()).toEqual(asked);
		note = story.notes()[P.kohlekraftwerkReading];
		expect(readingMetadata(note).breakdownSettled).toBe("Unresolved");
	});
});
