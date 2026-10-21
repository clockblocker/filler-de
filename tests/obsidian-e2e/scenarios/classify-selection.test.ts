import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

/**
 * The scripted jev's answers that segment "Er fängt heute an." into Er
 * (PRON), the separable verb fängt … an (VERB, Segments 2 and 6) and heute
 * (ADV). Every other question gets the scripted defaults, German included.
 */
const FAENGT_AN = {
	i_1: "c0",
	r_1: "Lexeme/PRON",
	r_2_4: "Lexeme/VERB",
	r_3: "Lexeme/ADV",
	s_particle_4: "p2",
};

const STORY = "Der Hund schläft. Er fängt heute an.\n\nDanach ging er nach Hause.\n";

describe("Obsidian E2E - Classify", () => {
	it("hands the selection's units to resolution as UnitRefs and caches each Sentence", async () => {
		await withObsidianScenario(
			{
				dumgen: { jev: FAENGT_AN },
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-selection",
			},
			async ({ act, snapshot, status }) => {
				const before = (await snapshot()).markdown["Story.md"];
				expect((await status()).classify).toBeNull();

				// Selecting one piece of a separable verb classifies the whole unit.
				await act({ kind: "runClassify", path: "Story.md", selection: "an." });
				const first = (await status()).classify;
				expect(first?.scrollPath).toBe("Story.md");
				expect(first?.units).toHaveLength(1);
				const verb = first?.units[0];
				if (!verb) throw new Error("Classify handed over no unit");
				const key = verb.ref.sentenceKey;
				expect(verb.family).toBe("Lexeme");
				expect(verb.kind).toBe("VERB");
				expect(verb.ref.segments).toEqual([2, 6]);
				expect(key).toMatch(/^[0-9a-f]{64}$/);
				expect(verb.occurrences.map(({ text }) => text)).toEqual([
					"fängt",
					"an",
				]);
				expect(first?.sentences).toEqual([
					{ sentenceKey: key, text: "Er fängt heute an." },
				]);
				expect(first?.resolutions).toEqual(["Pending"]);
				expect(first?.stats).toMatchObject({
					cachedSentences: 0,
					segmentedSentences: 1,
					touchedSentences: 1,
				});
				// Classify gives the unit's block an ID before it resolves
				// anything, so every Attestation Ref names a block the Scroll
				// holds. Without a scripted Luna no unit resolves, so that ID
				// is all it writes.
				expect((await snapshot()).markdown["Story.md"]).toBe(
					before?.replace("Er fängt heute an.\n", "Er fängt heute an. ^0\n"),
				);

				// The same Sentence again comes from the Segmentation Cache.
				await act({ kind: "runClassify", path: "Story.md", selection: "heute" });
				const second = (await status()).classify;
				expect(second?.units.map(({ kind, ref }) => ({ kind, ref }))).toEqual([
					{
						kind: "ADV",
						ref: { segments: [4], sentenceKey: key },
					},
				]);
				expect(second?.stats).toMatchObject({
					cachedSentences: 1,
					segmentedSentences: 0,
				});

				// Editing one Sentence invalidates only its own segmentation.
				const current = (await snapshot()).markdown["Story.md"] ?? "";
				await act({
					content: current.replace("schläft", "bellt"),
					kind: "modifyFile",
					path: "Story.md",
				});
				await act({
					kind: "runClassify",
					path: "Story.md",
					selection: "bellt. Er",
				});
				const third = (await status()).classify;
				expect(third?.stats).toMatchObject({
					cachedSentences: 1,
					segmentedSentences: 1,
					touchedSentences: 2,
				});
				expect(third?.sentences.map(({ text }) => text)).toEqual([
					"Der Hund bellt.",
					"Er fängt heute an.",
				]);
				expect(
					third?.sentences.find(({ text }) => text === "Er fängt heute an.")
						?.sentenceKey,
				).toBe(key);
				expect(
					third?.units.some(({ kind, ref }) =>
						kind === "PRON" &&
						ref.sentenceKey === key &&
						ref.segments.join() === "0",
					),
				).toBe(true);
			},
		);
	});
});
