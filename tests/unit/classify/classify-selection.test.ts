import { describe, expect, it } from "bun:test";
import { Cause, Exit } from "effect";
import type { ClassifyError } from "../../../src/commanders/classify/classify-selection";
import { sentenceKey } from "../../../src/commanders/classify/sentence-key";
import { PENDING_RESOLUTION_REASON } from "../../../src/commanders/classify/unit-resolver";
import { classifyHarness, selectionOf } from "./support";

const SCROLL = [
	"---",
	"status: NotStarted",
	"---",
	"Der Hund schläft. Er fängt heute an. ^0",
	"",
	"Danach [[Worter/de/Lexeme/VERB/gehen#^r-1|ging]] er nach Hause. ^1",
	"",
].join("\n");

const textsOf = (content: string, ranges: readonly { from: number; to: number }[]) =>
	ranges.map(({ from, to }) => content.slice(from, to));

const failureOf = (exit: Exit.Exit<unknown, ClassifyError>) => {
	if (Exit.isSuccess(exit)) throw new Error("Classify succeeded");
	const error = Cause.findErrorOption(exit.cause);
	if (error._tag === "None") throw new Error("Classify died");
	return error.value;
};

describe("classifySelection", () => {
	it("hands every piece of a discontinuous unit to resolution when one piece is selected", async () => {
		const harness = classifyHarness();
		const outcome = await harness.classify({
			content: SCROLL,
			scrollPath: "Library/Story.md",
			selection: selectionOf(SCROLL, "an."),
		});
		const key = sentenceKey("test-segmenter", "de", "Er fängt heute an.");
		expect(outcome.plan.units).toHaveLength(1);
		const [verb] = outcome.plan.units;
		expect(verb?.ref).toEqual({ segments: [2, 6], sentenceKey: key });
		expect(verb?.unit.route).toEqual({
			family: "Lexeme",
			kind: "VERB",
			language: "de",
		});
		expect(textsOf(SCROLL, verb?.occurrences ?? [])).toEqual(["fängt", "an"]);
		expect(outcome.plan.scrollPath).toBe("Library/Story.md");
		expect([...outcome.plan.sentences.keys()]).toEqual([key]);
		expect(outcome.plan.sentences.get(key)?.neighbours).toEqual({
			after: "Danach ging er nach Hause.",
			before: "Der Hund schläft.",
		});
		expect(outcome.resolutions).toEqual([
			{
				_tag: "Pending",
				reason: PENDING_RESOLUTION_REASON,
				ref: { segments: [2, 6], sentenceKey: key },
			},
		]);
		expect(harness.handedOver).toEqual([outcome.plan]);
	});

	it("includes a unit when the selection covers any part of any of its Segments", async () => {
		const harness = classifyHarness();
		const outcome = await harness.classify({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, "ute a"),
		});
		expect(
			outcome.plan.units.map(({ unit, occurrences }) => ({
				kind: unit.route === "Unresolved" ? "Unresolved" : unit.route.kind,
				texts: textsOf(SCROLL, occurrences),
			})),
		).toEqual([
			{ kind: "VERB", texts: ["fängt", "an"] },
			{ kind: "ADV", texts: ["heute"] },
		]);
	});

	it("skips whitespace and punctuation, and carries a closed-class identity", async () => {
		const harness = classifyHarness();
		const outcome = await harness.classify({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, ". Er "),
		});
		expect(outcome.plan.units.map(({ ref }) => ref.segments)).toEqual([[0]]);
		expect(outcome.plan.units[0]?.unit.identity).toEqual({
			canonicalForm: "er",
			kind: "PRON",
			pronType: "Prs",
		});
		// The selection also touches "Der Hund schläft.", whose units it does not cover.
		expect(outcome.plan.sentences.size).toBe(2);
		expect(outcome.stats).toMatchObject({
			germanSentences: 2,
			segmentedSentences: 2,
			touchedSentences: 2,
		});
	});

	it("segments a repeated Sentence once and keeps each instance's units separate", async () => {
		const harness = classifyHarness();
		const content = "Er fängt heute an. Er fängt heute an.";
		const outcome = await harness.classify({
			content,
			scrollPath: "Story.md",
			selection: { from: 0, to: content.length },
		});
		expect(outcome.plan.sentences.size).toBe(1);
		const second = content.lastIndexOf("Er");
		expect(
			outcome.plan.units.map(({ instance, ref, occurrences }) => ({
				from: occurrences[0]?.from,
				instance,
				segments: ref.segments,
				texts: textsOf(content, occurrences),
			})),
		).toEqual([
			{ from: 0, instance: 0, segments: [0], texts: ["Er"] },
			{ from: 3, instance: 0, segments: [2, 6], texts: ["fängt", "an"] },
			{ from: 9, instance: 0, segments: [4], texts: ["heute"] },
			{ from: second, instance: 1, segments: [0], texts: ["Er"] },
			{ from: second + 3, instance: 1, segments: [2, 6], texts: ["fängt", "an"] },
			{ from: second + 9, instance: 1, segments: [4], texts: ["heute"] },
		]);
		// Both instances share one UnitRef per unit.
		expect(outcome.plan.units[0]?.ref).toEqual(outcome.plan.units[3]?.ref);
		expect(outcome.stats).toMatchObject({
			segmentedSentences: 1,
			touchedSentences: 2,
		});
	});

	it("maps a link's shown text back to the Scroll", async () => {
		const harness = classifyHarness();
		const outcome = await harness.classify({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, "ging"),
		});
		expect(outcome.plan.units).toHaveLength(1);
		const [first] = outcome.plan.units[0]?.occurrences ?? [];
		expect(first).toEqual(selectionOf(SCROLL, "ging"));
	});

	it("segments a Sentence once and reads it from the cache afterwards", async () => {
		const harness = classifyHarness();
		const input = {
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, "heute"),
		};
		const first = await harness.classify(input);
		const asked = harness.requests().candidates;
		const second = await harness.classify(input);
		expect(first.stats).toMatchObject({ cachedSentences: 0, segmentedSentences: 1 });
		expect(second.stats).toMatchObject({ cachedSentences: 1, segmentedSentences: 0 });
		expect(harness.requests().candidates).toBe(asked);
		expect(second.plan.units).toEqual(first.plan.units);
	});

	it("re-segments exactly the edited Sentence", async () => {
		const harness = classifyHarness();
		const everything = (content: string) => ({
			content,
			scrollPath: "Story.md",
			selection: { from: content.indexOf("Der"), to: content.length },
		});
		await harness.classify(everything(SCROLL));
		expect(harness.cache.entries.size).toBe(3);
		const edited = SCROLL.replace("schläft", "bellt");
		const outcome = await harness.classify(everything(edited));
		expect(outcome.stats).toMatchObject({
			cachedSentences: 2,
			segmentedSentences: 1,
		});
		expect(harness.cache.entries.size).toBe(4);
		expect(
			harness.cache.entries.has(sentenceKey("test-segmenter", "de", "Der Hund bellt.")),
		).toBe(true);
	});

	it("never caches a failed segmentation", async () => {
		const harness = classifyHarness({ failStage: "route" });
		const outcome = await harness.classify({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, "heute"),
		});
		expect(outcome.plan.units).toEqual([]);
		expect(outcome.stats).toMatchObject({ failedSentences: 1, segmentedSentences: 0 });
		expect(harness.cache.entries.size).toBe(0);
	});

	it("refuses an empty selection and a selection outside every Sentence", async () => {
		const harness = classifyHarness();
		const empty = await harness.classifyExit({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: { from: 40, to: 40 },
		});
		expect(failureOf(empty).reason).toBe("EmptySelection");
		const frontmatter = await harness.classifyExit({
			content: SCROLL,
			scrollPath: "Story.md",
			selection: selectionOf(SCROLL, "status"),
		});
		expect(failureOf(frontmatter).reason).toBe("NoSentence");
	});

	it("refuses a selection with no German Sentence", async () => {
		const harness = classifyHarness({
			answers: {
				"sentence-0": {
					choice: "English",
					confidence: 1,
					probabilities: { English: 1 },
					type: "choice",
				},
			},
		});
		const content = "The dog sleeps.";
		const exit = await harness.classifyExit({
			content,
			scrollPath: "Story.md",
			selection: selectionOf(content, "dog"),
		});
		expect(failureOf(exit).reason).toBe("NoGermanSentence");
	});
});
