import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import {
	ClassifyCommander,
	memorySegmentationCache,
	pendingUnitResolver,
} from "../../../src/commanders/classify";
import { dictionaryNoteRefusal } from "../../../src/commanders/classify/classify-commander";
import {
	type DumgenProvide,
	DumgenUnavailable,
} from "../../../src/managers/dumgen";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";
import { provideFakes } from "../dumgen/dumgen-support";
import { FAENGT_AN_ANSWERS, selectionOf } from "./support";

const STORY = "Der Hund schläft. Er fängt heute an.\n\nDanach ging er nach Hause.\n";

function commander(dumgen: DumgenProvide) {
	const notices: string[] = [];
	const classify = new ClassifyCommander({
		cache: memorySegmentationCache(),
		dumgen,
		resolver: pendingUnitResolver,
		segmenterVersion: Effect.succeed("test-segmenter"),
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

const scripted = provideFakes({ jev: createScriptedJev(FAENGT_AN_ANSWERS).ask });

/** A dumgen that must not be reached. */
const untouched: DumgenProvide = () =>
	Effect.die(new Error("this Classify must not reach dumgen"));

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
			dumgen: untouched,
			resolver: pendingUnitResolver,
			segmenterVersion: Effect.succeed("test-segmenter"),
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

	it("refuses a note inside Worter/, before anything else, and says why (#210)", async () => {
		const asked: string[] = [];
		const notices: string[] = [];
		const classify = new ClassifyCommander({
			blockedBy: (scrollPath) => {
				asked.push(scrollPath);
				return undefined;
			},
			cache: memorySegmentationCache(),
			dumgen: untouched,
			resolver: pendingUnitResolver,
			segmenterVersion: Effect.succeed("test-segmenter"),
		});
		for (const scrollPath of [
			"Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter.md",
			"worter/m/mut/mutte/mutter.md",
		])
			await Effect.runPromise(
				classify.execute(
					{
						content: STORY,
						scrollPath,
						selection: selectionOf(STORY, "an."),
					},
					(message) => notices.push(message),
				),
			);
		expect(asked).toEqual([]);
		expect(notices).toEqual([
			"⚠ Classify does not run on dictionary notes: Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter.md lies in Worter/. Classify a text outside it.",
			"⚠ Classify does not run on dictionary notes: worter/m/mut/mutte/mutter.md lies in Worter/. Classify a text outside it.",
		]);
		expect(classify.latestHandoff()).toBeNull();
	});

	it("lets a note whose folder only starts like Worter be classified", () => {
		expect(dictionaryNoteRefusal("Wortertexte/Story.md")).toBeUndefined();
		expect(dictionaryNoteRefusal("Worter.md")).toBeUndefined();
		expect(dictionaryNoteRefusal("Library/Worter/Story.md")).toBeUndefined();
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

	it("reports a dumgen that could not be built instead of throwing", async () => {
		const { notices, run } = commander(() =>
			Effect.fail(
				new DumgenUnavailable({
					cause: new Error("the settings could not be read"),
					message: "dumgen is unavailable: the settings could not be read",
				}),
			),
		);
		await run(STORY, "heute");
		expect(notices).toEqual([
			"⚠ dumgen is unavailable: the settings could not be read",
		]);
	});
});
