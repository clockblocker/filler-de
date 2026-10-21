import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	FIRST_SELECTION,
	LEMMA_PATHS,
	SECOND_SELECTION,
	STORY,
} from "./classify-resolution-script";

/** Luna stages a Reading's base-text Knowledge goes through. */
const KNOWLEDGE_STAGES = ["transcription", "definition", "translations"];

const linkTo = (path: string, shown: string) =>
	`[[${path.slice(0, -3)}|${shown}]]`;

/** An occurrence's Attestation Ref in block `^0` or `^1` of the Story. */
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

				const story = (await snapshot()).markdown["Story.md"];
				expect(story).toBe(
					healed.replace(
						STORY,
						`${linkTo(hund.readingPath, "Der Hund")} ${linkTo(anfangen.readingPath, "fängt")} ${linkTo(heute.readingPath, "heute")} ${linkTo(aufJedenFall.readingPath, "auf jeden Fall")} ${linkTo(anfangen.readingPath, "an")}. ^0\n\nDer Hund schläft. ^1\n`,
					),
				);

				// Each Lemma note sits at its identity path and links the
				// Reading note the Scroll links, which shows the occurrence
				// under Deine Kontexte.
				let notes = (await dictionary()).markdown;
				for (const [index, { readingPath }] of targets.entries()) {
					const lemmaPath = lemmaPaths[index] ?? "";
					expect(notes[readingPath]).toMatch(KONTEXT_0);
					expect(notes[lemmaPath]).toContain(readingPath.slice(0, -3));
				}
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
				notes = (await dictionary()).markdown;
				expect(notes[hund.readingPath]).toMatch(KONTEXT_0);
				expect(notes[hund.readingPath]).toMatch(KONTEXT_1);
				expect(await knowledgeCalls()).toEqual(before);
				expect((await snapshot()).markdown["Story.md"]).toContain(
					`${linkTo(hund.readingPath, "Der Hund")} schläft. ^1`,
				);
			},
		);
	});
});
