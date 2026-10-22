import { describe, expect, it } from "bun:test";
import { createDumgen } from "dumgen";
import { Effect } from "effect";
import {
	ClassifyCommander,
	memorySegmentationCache,
	pendingUnitResolver,
} from "../../../src/commanders/classify";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";
import { FAENGT_AN_ANSWERS, selectionOf } from "./support";

const STORY = "Der Hund schläft. Er fängt heute an.\n\nDanach ging er nach Hause.\n";

function commander(dumgen: () => ReturnType<typeof createDumgen>) {
	const notices: string[] = [];
	const classify = new ClassifyCommander({
		cache: memorySegmentationCache(),
		dumgen,
		resolver: pendingUnitResolver,
		segmenterVersion: () => "test-segmenter",
	});
	const run = (content: string, selection: string | null) =>
		Effect.runPromise(
			classify.execute(
				{
					content,
					scrollPath: "Library/Story.md",
					selection: selection === null ? null : selectionOf(content, selection),
				},
				(message) => notices.push(message),
			),
		);
	return { classify, notices, run };
}

const scripted = () =>
	createDumgen({
		jev: createScriptedJev(FAENGT_AN_ANSWERS).ask,
		luna: () => Promise.reject(new Error("no Luna")),
	});

describe("ClassifyCommander", () => {
	it("writes nothing to a Scroll it is blocked on, and says why", async () => {
		const asked: string[] = [];
		const notices: string[] = [];
		const classify = new ClassifyCommander({
			blockedBy: (scrollPath) => {
				asked.push(scrollPath);
				return `Textfresser does not write to ${scrollPath}`;
			},
			cache: memorySegmentationCache(),
			dumgen: () => {
				throw new Error("a blocked Classify must not reach dumgen");
			},
			resolver: pendingUnitResolver,
			segmenterVersion: () => "test-segmenter",
		});
		await Effect.runPromise(
			classify.execute(
				{
					content: STORY,
					scrollPath: "Exemplar/Story.md",
					selection: selectionOf(STORY, "an."),
				},
				(message) => notices.push(message),
			),
		);
		expect(asked).toEqual(["Exemplar/Story.md"]);
		expect(notices).toEqual([
			"⚠ Textfresser does not write to Exemplar/Story.md",
		]);
		expect(classify.latestHandoff()).toBeNull();
	});

	// The desktop scenario `classify-selection` tells this story in Obsidian.
	it("records each hand-off and reuses cached Sentences across runs", async () => {
		const { classify, notices, run } = commander(scripted);
		await run(STORY, "an.");
		const first = classify.latestHandoff();
		expect(first?.units).toEqual([
			{
				family: "Lexeme",
				kind: "VERB",
				occurrences: [
					{ ...selectionOf(STORY, "fängt"), text: "fängt" },
					{ ...selectionOf(STORY, "an."), text: "an", to: selectionOf(STORY, "an.").to - 1 },
				],
				ref: { segments: [2, 6], sentenceKey: first?.sentences[0]?.sentenceKey ?? "" },
			},
		]);
		expect(first?.resolutions).toEqual(["Pending"]);
		expect(notices).toEqual([
			"Classified 1 unit in 1 Sentence; 1 pending resolution (Resolution is switched off)",
		]);

		await run(STORY, "heute");
		expect(classify.latestHandoff()?.stats).toMatchObject({
			cachedSentences: 1,
			segmentedSentences: 0,
		});

		const edited = STORY.replace("schläft", "bellt");
		await run(edited, "bellt. Er");
		const third = classify.latestHandoff();
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
			third?.units.some(
				({ kind, ref }) =>
					kind === "PRON" &&
					ref.sentenceKey === first?.sentences[0]?.sentenceKey &&
					ref.segments.join() === "0",
			),
		).toBe(true);
	});

	it("tells the user why nothing was classified, and forgets the earlier hand-off", async () => {
		const { classify, notices, run } = commander(scripted);
		await run(STORY, "heute");
		expect(classify.latestHandoff()).not.toBeNull();
		await run(STORY, null);
		expect(notices.at(-1)).toBe("⚠ Select the text to classify.");
		expect(classify.latestHandoff()).toBeNull();
	});

	it("reports a dumgen that is gone instead of throwing", async () => {
		const { notices, run } = commander(() => {
			throw new Error("dumgen was disposed when the plugin unloaded");
		});
		await run(STORY, "heute");
		expect(notices).toEqual([
			"⚠ dumgen is unavailable: dumgen was disposed when the plugin unloaded",
		]);
	});
});
