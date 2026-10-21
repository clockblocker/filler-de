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

const linkTo = (path: string, blockId: string, shown: string) =>
	`[[${path.slice(0, -3)}#^${blockId}|${shown}]]`;

describe("Obsidian E2E - Classify resolution", () => {
	it("links each Segment to its Reading block at the Lemma's identity path, and re-encounters a sense without Knowledge calls", async () => {
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
					if (!("lemmaPath" in resolved))
						throw new Error(`A unit stayed pending: ${resolved.pending}`);
					return resolved;
				});
				expect(targets.map(({ lemmaPath }) => lemmaPath)).toEqual([
					LEMMA_PATHS.hund,
					LEMMA_PATHS.anfangen,
					LEMMA_PATHS.heute,
					LEMMA_PATHS.aufJedenFall,
				]);
				const [hund, anfangen, heute, aufJedenFall] = targets;
				if (!hund || !anfangen || !heute || !aufJedenFall)
					throw new Error("Classify resolved fewer units than it reported");
				expect(anfangen.linked).toBe(2);

				const story = (await snapshot()).markdown["Story.md"];
				expect(story).toBe(
					healed.replace(
						STORY,
						`${linkTo(hund.lemmaPath, hund.readingBlockId, "Der Hund")} ${linkTo(anfangen.lemmaPath, anfangen.readingBlockId, "fängt")} ${linkTo(heute.lemmaPath, heute.readingBlockId, "heute")} ${linkTo(aufJedenFall.lemmaPath, aufJedenFall.readingBlockId, "auf jeden Fall")} ${linkTo(anfangen.lemmaPath, anfangen.readingBlockId, "an")}. ^0\n\nDer Hund schläft. ^1\n`,
					),
				);

				// Each Lemma note sits at its identity path and holds the
				// Reading block the links point at. TODO(#113): and the
				// occurrence's Attestation Link, once the store keeps them.
				let notes = (await dictionary()).markdown;
				for (const { lemmaPath, readingBlockId } of targets) {
					expect(notes[lemmaPath]).toContain(`^${readingBlockId}`);
					expect(notes[lemmaPath]).not.toContain("![[Story#^0|^]]");
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
					lemmaPath: LEMMA_PATHS.hund,
					linked: 1,
					readingBlockId: hund.readingBlockId,
				});
				notes = (await dictionary()).markdown;
				expect(notes[LEMMA_PATHS.hund]).not.toContain("![[Story#^1|^]]");
				expect(await knowledgeCalls()).toEqual(before);
				expect((await snapshot()).markdown["Story.md"]).toContain(
					`${linkTo(hund.lemmaPath, hund.readingBlockId, "Der Hund")} schläft. ^1`,
				);
			},
		);
	});
});
