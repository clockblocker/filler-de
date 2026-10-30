import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
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
} from "./classify-breakdown-script";
import { classifyAndClick } from "./click-links";
import { expectHiddenMetadata, linkTo } from "./dictionary-layout";

const P = COMPOUND_PATHS;
const C = CONVERSION_PATHS;
const X = PART_CROSSROADS;

describe("Obsidian E2E - Breakdowns (#264)", () => {
	it("shows a compound's Breakdown, re-points it to a stored part, and back once the part goes", async () => {
		await withObsidianScenario(
			{
				dumgen: COMPOUND_DUMGEN,
				fixture: [{ content: COMPOUND_STORY, path: "Story.md" }],
				id: "classify-breakdown",
				resetDictionary: true,
			},
			async (scenario) => {
				const { act, dictionary, snapshot, status } = scenario;
				// Kohlekraftwerk first, then a click on its link: the click asks
				// for its Knowledge, whose Breakdown runs in the background
				// Knowledge run, which act() waits for (#281).
				await classifyAndClick(scenario, SELECTIONS.kohlekraftwerk);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: P.kohlekraftwerkReading },
				]);
				let notes = (await dictionary()).markdown;
				expectHiddenMetadata(notes[P.kohlekraftwerkReading], "readingNote");
				// Kraftwerk is pending: a link to its Crossroad path, and one
				// Unsplit chunk in the morphemes line.
				const pending = [
					morphemesLine([X.kohle, "Kohle"], [X.kraftwerk, "kraftwerk"]),
					constituentsLine([X.kohle, "Kohle"], [X.kraftwerk, "Kraftwerk"]),
				];
				expectMorphemeSection(notes[P.kohlekraftwerkReading], pending);
				expect(notes[X.kraftwerk]).toBeUndefined();
				expect(formationLines(notes[P.kohlekraftwerkLemma])).toEqual([]);

				// Kraftwerk next: it is broken down in turn, and Kohlekraftwerk's
				// part moves to its Lemma note in the same commit.
				await classifyAndClick(scenario, SELECTIONS.kraftwerk);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: P.kraftwerkReading },
				]);
				notes = (await dictionary()).markdown;
				expectMorphemeSection(notes[P.kraftwerkReading], [
					morphemesLine([X.kraft, "Kraft"], [X.werk, "werk"]),
					constituentsLine([X.kraft, "Kraft"], [X.werk, "Werk"]),
				]);
				const stored = [
					morphemesLine(
						[X.kohle, "Kohle"],
						[X.kraft, "kraft"],
						[X.werk, "werk"],
					),
					constituentsLine([X.kohle, "Kohle"], [P.kraftwerkLemma, "Kraftwerk"]),
				];
				expectMorphemeSection(notes[P.kohlekraftwerkReading], stored);
				// Kraftwerk's Lemma note lists the word built on it (#269),
				// linking its Reading note.
				const formations = [
					formationLine("Komposita", [
						P.kohlekraftwerkReading,
						"Kohlekraftwerk",
					]),
				];
				expect(formationLines(notes[P.kraftwerkLemma])).toEqual(formations);
				const asked = breakdownRequests((await status()).dumgenRequests);
				expect(asked["jev:breakdown-analysis"]).toBe(2);

				// Kohlekraftwerk again, clicked: it stores its Breakdown, so the
				// Knowledge run its click asks for asks for neither a Source nor
				// a split.
				await classifyAndClick(scenario, SELECTIONS.kohlekraftwerkAgain);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: P.kohlekraftwerkReading },
				]);
				expect(breakdownRequests((await status()).dumgenRequests)).toEqual(
					asked,
				);
				notes = (await dictionary()).markdown;
				expectMorphemeSection(notes[P.kohlekraftwerkReading], stored);
				expect(formationLines(notes[P.kraftwerkLemma])).toEqual(formations);

				// The user unlinks Kraftwerk's only occurrence: its notes go, with
				// its Formations, and Kohlekraftwerk's part links its Crossroad
				// path again.
				const scroll = (await snapshot()).markdown["Story.md"] ?? "";
				const unlinked = scroll.replace(
					linkTo(P.kraftwerkReading, "Das Kraftwerk"),
					"Das Kraftwerk",
				);
				expect(unlinked).not.toBe(scroll);
				await act({ content: unlinked, kind: "modifyFile", path: "Story.md" });
				notes = (await dictionary()).markdown;
				expect(notes[P.kraftwerkReading]).toBeUndefined();
				expect(notes[P.kraftwerkLemma]).toBeUndefined();
				expect(formationLines(notes[P.kohlekraftwerkLemma])).toEqual([]);
				expectMorphemeSection(notes[P.kohlekraftwerkReading], pending);
			},
		);
	});

	it("shows a conversion's Source line, and re-points it to the base's Lemma note", async () => {
		await withObsidianScenario(
			{
				dumgen: CONVERSION_DUMGEN,
				fixture: [{ content: CONVERSION_STORY, path: "Story.md" }],
				id: "classify-breakdown-source",
				resetDictionary: true,
			},
			async (scenario) => {
				const { dictionary, status } = scenario;
				// Lauf is a conversion of laufen: a Source line, no constituents.
				await classifyAndClick(scenario, CONVERSION_SELECTIONS.lauf);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: C.laufReading },
				]);
				expectMorphemeSection((await dictionary()).markdown[C.laufReading], [
					morphemesLine([X.laufen, "Lauf"]),
					sourceLine(X.laufen, "laufen"),
				]);
				const asked = breakdownRequests((await status()).dumgenRequests);
				expect(asked).toMatchObject({
					"jev:breakdown-analysis": 0,
					"jev:sourceFormation": 1,
					"jev:sourceJudgment": 1,
					"luna:sourceBase": 1,
				});

				// Lauf again: it stores its Source, so nothing more is asked.
				await classifyAndClick(scenario, CONVERSION_SELECTIONS.laufAgain);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: C.laufReading },
				]);
				expect(breakdownRequests((await status()).dumgenRequests)).toEqual(
					asked,
				);

				// laufen has no Source and no cut: a bottom word, split into
				// its morphemes; Lauf's Source moves to its Lemma note.
				await classifyAndClick(scenario, CONVERSION_SELECTIONS.laufen);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: C.laufenReading },
				]);
				const notes = (await dictionary()).markdown;
				expectMorphemeSection(notes[C.laufenReading], [
					morphemesLine([X.lauf, "lauf"], [X.en, "en"]),
				]);
				expectMorphemeSection(notes[C.laufReading], [
					morphemesLine([X.lauf, "Lauf"]),
					sourceLine(C.laufenLemma, "laufen"),
				]);
				// laufen's Lemma note lists Lauf as built from it (#269).
				expect(formationLines(notes[C.laufenLemma])).toEqual([
					formationLine("Grundform von", [C.laufReading, "Lauf"]),
				]);
			},
		);
	});

	it("settles a Reading whose Source is Unresolved, and asks it no more", async () => {
		await withObsidianScenario(
			{
				dumgen: SETTLED_DUMGEN,
				fixture: [{ content: COMPOUND_STORY, path: "Story.md" }],
				id: "classify-breakdown-settled",
				resetDictionary: true,
			},
			async (scenario) => {
				const { dictionary, status } = scenario;
				await classifyAndClick(scenario, SELECTIONS.kohlekraftwerk);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: P.kohlekraftwerkReading },
				]);
				let note = (await dictionary()).markdown[P.kohlekraftwerkReading];
				// No Breakdown and no Source: no Morpheme section, and the note
				// records why the Reading is asked no more.
				expect(morphemeLines(note)).toBeUndefined();
				expect(readingMetadata(note).breakdownSettled).toBe("Unresolved");
				const asked = breakdownRequests((await status()).dumgenRequests);
				expect(asked).toMatchObject({
					"jev:breakdown-analysis": 0,
					"jev:sourceFormation": 1,
				});

				await classifyAndClick(scenario, SELECTIONS.kohlekraftwerkAgain);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: P.kohlekraftwerkReading },
				]);
				expect(breakdownRequests((await status()).dumgenRequests)).toEqual(
					asked,
				);
				note = (await dictionary()).markdown[P.kohlekraftwerkReading];
				expect(readingMetadata(note).breakdownSettled).toBe("Unresolved");
			},
		);
	});
});
