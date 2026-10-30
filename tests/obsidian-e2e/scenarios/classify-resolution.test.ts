import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
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
} from "./classify-resolution-script";
import { expectInOrder, linkTo, TITLES, visible } from "./dictionary-layout";

/** Luna stages a Reading's base-text Knowledge goes through. */
const KNOWLEDGE_STAGES = ["transcription", "definition", "translations"];

/** An occurrence's Attestation Ref in block `^0` or `^1` of the Story: the block, with the occurrence's key as its alias. */
const KONTEXT_0 = /!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]/u;
const KONTEXT_1 = /!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u;

/** The folder a note sits in. */
const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

describe("Obsidian E2E - Classify resolution", () => {
	it("links each Segment to its Reading note beside its Lemma note, and re-encounters a sense without Knowledge calls", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-resolution",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				// Healing has given the Scroll its go-back link; Classify must
				// leave everything but the classified Sentence as it found it.
				const healed = (await snapshot()).markdown["Story.md"] ?? "";
				expect(healed).toContain(STORY);

				// A noun, a separable verb and a Locution in one selection.
				await act({
					kind: "runClassify",
					path: "Story.md",
					selection: FIRST_SELECTION,
				});
				const first = (await status()).classify;
				expect(first?.resolutions).toEqual([
					"Resolved",
					"Resolved",
					"Resolved",
					"Resolved",
				]);
				const targets = (first?.resolved ?? []).map((resolved) => {
					if (!("readingPath" in resolved))
						throw new Error(`A unit stayed pending: ${resolved.pending}`);
					return resolved;
				});
				// Each Reading note sits in its Lemma note's folder.
				const lemmaPaths = [
					LEMMA_PATHS.hund,
					LEMMA_PATHS.anfangen,
					LEMMA_PATHS.heute,
					LEMMA_PATHS.aufJedenFall,
				];
				expect(targets.map(({ readingPath }) => folderOf(readingPath))).toEqual(
					lemmaPaths.map(folderOf),
				);
				const [hund, anfangen, heute, aufJedenFall] = targets;
				if (!hund || !anfangen || !heute || !aufJedenFall)
					throw new Error("Classify resolved fewer units than it reported");
				expect(anfangen.linked).toBe(2);
				// A Reading note is named `<emoji> <Lemma spelling>.md`.
				expect(hund.readingPath).toBe(
					`${folderOf(LEMMA_PATHS.hund)}/🐕 Hund.md`,
				);

				const story = (await snapshot()).markdown["Story.md"];
				expect(story).toBe(
					healed.replace(
						STORY,
						`${linkTo(hund.readingPath, "Der Hund")} ${linkTo(anfangen.readingPath, "fängt")} ${linkTo(heute.readingPath, "heute")} ${linkTo(aufJedenFall.readingPath, "auf jeden Fall")} ${linkTo(anfangen.readingPath, "an")}. ^0\n\nDer Hund schläft. ^1\n`,
					),
				);

				let notes = (await dictionary()).markdown;
				expectFirstClassifyNotes(
					notes,
					targets.map(({ readingPath }) => readingPath),
				);
				expect(`${story}\n${Object.values(notes).join("\n")}`).not.toContain(
					"%%tf",
				);

				const knowledgeCalls = async () => {
					const requests = (await status()).dumgenRequests;
					return KNOWLEDGE_STAGES.map((stage) => requests?.luna[stage] ?? 0);
				};
				const before = await knowledgeCalls();
				expect(before.every((count) => count > 0)).toBe(true);

				// The same sense again: one more Attestation, no Knowledge call.
				await act({
					kind: "runClassify",
					path: "Story.md",
					selection: SECOND_SELECTION,
				});
				const again = (await status()).classify?.resolved?.[0];
				expect(again).toMatchObject({
					linked: 1,
					readingPath: hund.readingPath,
				});
				const previous = notes;
				notes = (await dictionary()).markdown;
				expectInOrder(visible(notes[hund.readingPath]), [
					TITLES.deineKontexte,
					"\n![[Story#^0|^",
					"\n![[Story#^1|^",
					TITLES.note,
				]);
				expect(notes[hund.readingPath]).toMatch(KONTEXT_0);
				expect(notes[hund.readingPath]).toMatch(KONTEXT_1);
				// The same Surface again: the Lemma note and the Crossroad stay.
				expect(notes[LEMMA_PATHS.hund]).toBe(previous[LEMMA_PATHS.hund]);
				expect(notes[CROSSROAD_PATHS.hund]).toBe(previous[CROSSROAD_PATHS.hund]);
				expect(await knowledgeCalls()).toEqual(before);
				expect((await snapshot()).markdown["Story.md"]).toContain(
					`${linkTo(hund.readingPath, "Der Hund")} schläft. ^1`,
				);
			},
		);
	});

	it("cuts a pasted paragraph of several Sentences into sentence blocks, so each Attestation embeds its own Sentence", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: SENTENCE_BLOCKS_STORY, path: "Story.md" }],
				id: "classify-sentence-blocks",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				const healed = (await snapshot()).markdown["Story.md"] ?? "";
				expect(healed).toContain(SENTENCE_BLOCKS_STORY);

				await act({
					kind: "runClassify",
					path: "Story.md",
					selection: SENTENCE_BLOCKS_SELECTION,
				});
				const hund = (await status()).classify?.resolved?.[0];
				if (!hund || !("readingPath" in hund))
					throw new Error("Der Hund did not resolve");
				expect(hund.linked).toBe(1);

				// One block per Sentence, the short ones too; nothing else changed.
				expect((await snapshot()).markdown["Story.md"]).toBe(
					healed.replace(
						SENTENCE_BLOCKS_STORY,
						sentenceBlocksStory(linkTo(hund.readingPath, "Der Hund")),
					),
				);
				// The Attestation embeds Der Hund's own Sentence, in ^1.
				const note = (await dictionary()).markdown[hund.readingPath];
				expect(note).toMatch(KONTEXT_1);
				expect(note).not.toMatch(KONTEXT_0);

				// The user unlinks Der Hund: its block links nothing, so it goes.
				const cut = (await snapshot()).markdown["Story.md"] ?? "";
				const unlinked = cut.replace(
					linkTo(hund.readingPath, "Der Hund"),
					"Der Hund",
				);
				await act({ content: unlinked, kind: "modifyFile", path: "Story.md" });
				expect(
					(await dictionary()).markdown[hund.readingPath],
				).toBeUndefined();

				// Classify again: the blocks keep their IDs, nothing is cut again.
				await act({
					kind: "runClassify",
					path: "Story.md",
					selection: SENTENCE_BLOCKS_SELECTION,
				});
				const again = (await status()).classify?.resolved?.[0];
				if (!again || !("readingPath" in again))
					throw new Error("Der Hund did not resolve again");
				expect((await snapshot()).markdown["Story.md"]).toBe(
					healed.replace(
						SENTENCE_BLOCKS_STORY,
						sentenceBlocksStory(linkTo(again.readingPath, "Der Hund")),
					),
				);
				expect((await dictionary()).markdown[again.readingPath]).toMatch(
					KONTEXT_1,
				);
			},
		);
	});
});
