/**
 * Classify's first stage (#63): segment the Sentences a selection touches
 * and map the selection to the dumgen units it covers, then hand the plan
 * to the resolver port (#74).
 *
 * 1. Split the Scroll with dumgen (`scrollSentences`) and keep the
 *    Sentences the selection overlaps.
 * 2. `language.detect` them with a few neighbours for context; only German
 *    Sentences go on, since dumgen segments German only.
 * 3. Key each by its Stitched Text (ADR 0014), read the Segmentation Cache,
 *    and `segment.inUnits` only the misses, storing every success.
 * 4. A unit is covered when the selection overlaps any of its Segments. It
 *    then joins the plan with all of its pieces, so each piece of a
 *    discontinuous unit links to the same Reading. A Sentence repeated in
 *    the Scroll shares its segmentation, but each instance gives units of
 *    its own, so each stays its own occurrence.
 *
 * It needs `Jev` and `Luna`: its caller provides one dumgen build for the
 * whole Classify, resolution included (`Dumgen.provide`).
 */
import {
	type Jev,
	type Luna,
	operations,
	type SegmentedSentence,
	type Unit,
} from "dumgen";
import { Context, Data, Effect, Option } from "effect";
import type { UserLinks } from "./resolution/scroll-links";
import {
	type ScrollSentence,
	type ScrollSentences,
	scrollSentences,
	segmentSourceRanges,
} from "./scroll-sentences";
import { SegmentationCache } from "./segmentation-cache";
import {
	sentenceInstances,
	sentenceKey,
	sentenceStitchedText,
} from "./sentence-key";
import type {
	ClassifyPlan,
	NeighbourSentences,
	PlannedSentence,
	PlannedUnit,
	SourceRange,
} from "./types";
import { type UnitResolution, UnitResolver } from "./unit-resolver";

/** How many Sentences on either side `language.detect` reads with the touched ones. */
const DETECTION_CONTEXT = 3;

export class ClassifyError extends Data.TaggedError("ClassifyError")<{
	readonly message: string;
	readonly reason:
		| "EmptySelection"
		| "NoSentence"
		| "NoGermanSentence"
		| "DumgenUnavailable"
		| "LanguageDetectionFailed"
		| "ResolutionFailed";
}> {}

/** The version that keys what dumgen segments. */
export class ClassifySegmenter extends Context.Service<
	ClassifySegmenter,
	{ readonly segmenterVersion: string }
>()("textfresser/classify/ClassifySegmenter") {}

export type ClassifyInput = {
	readonly scrollPath: string;
	/** The Scroll's content as the editor holds it. */
	readonly content: string;
	readonly selection: SourceRange;
	/** What happens to the user's links at the covered occurrences; `Keep` when absent. */
	readonly userLinks?: UserLinks;
};

export type ClassifyStats = {
	readonly touchedSentences: number;
	readonly germanSentences: number;
	readonly cachedSentences: number;
	readonly segmentedSentences: number;
	readonly failedSentences: number;
};

export type ClassifyOutcome = {
	readonly plan: ClassifyPlan;
	readonly resolutions: readonly UnitResolution[];
	readonly stats: ClassifyStats;
};

const overlaps = (range: SourceRange, selection: SourceRange) =>
	range.from < range.to &&
	range.from < selection.to &&
	range.to > selection.from;

/**
 * The unit's pieces in the source: runs of its Segments with only
 * Whitespace Segments between them.
 */
function occurrencesOf(
	unit: Unit,
	sentence: SegmentedSentence,
	ranges: readonly SourceRange[],
): SourceRange[] {
	const occurrences: SourceRange[] = [];
	let previous: number | undefined;
	for (const index of unit.segments) {
		const range = ranges[index];
		if (!range) continue;
		const last = occurrences.at(-1);
		const joined =
			last !== undefined &&
			previous !== undefined &&
			sentence.segments
				.slice(previous + 1, index)
				.every(({ kind }) => kind === "Whitespace");
		if (joined)
			occurrences[occurrences.length - 1] = { ...last, to: range.to };
		else occurrences.push(range);
		previous = index;
	}
	return occurrences;
}

function neighboursOf(
	sentences: readonly ScrollSentence[],
	index: number,
): NeighbourSentences {
	const before = sentences[index - 1]?.text;
	const after = sentences[index + 1]?.text;
	return {
		...(after === undefined ? {} : { after }),
		...(before === undefined ? {} : { before }),
	};
}

/** The covered units of one instance of a segmented Sentence, in reading order. */
function coveredUnits(
	scroll: ScrollSentences,
	sentence: ScrollSentence,
	segmented: SegmentedSentence,
	key: string,
	instance: number,
	selection: SourceRange,
): PlannedUnit[] {
	const ranges = segmentSourceRanges(scroll, sentence, segmented.segments);
	return [...segmented.units]
		.sort((a, b) => (a.segments[0] ?? 0) - (b.segments[0] ?? 0))
		.filter((unit) =>
			unit.segments.some((index) => {
				const range = ranges[index];
				return range !== undefined && overlaps(range, selection);
			}),
		)
		.map((unit) => ({
			instance,
			occurrences: occurrencesOf(unit, segmented, ranges),
			ref: { segments: [...unit.segments], sentenceKey: key },
			unit,
		}));
}

const detectGerman = Effect.fnUntraced(function* (
	sentences: readonly ScrollSentence[],
	touched: readonly number[],
) {
	const first = Math.max(0, (touched[0] ?? 0) - DETECTION_CONTEXT);
	const last = Math.min(
		sentences.length,
		(touched.at(-1) ?? 0) + DETECTION_CONTEXT + 1,
	);
	const detected = yield* operations.language
		.detect({
			paragraphs: [
				{
					sentences: sentences
						.slice(first, last)
						.map(({ text }) => text),
				},
			],
		})
		.pipe(
			Effect.mapError(
				(error) =>
					new ClassifyError({
						message: `Could not tell the selection's language: ${error.message}`,
						reason: "LanguageDetectionFailed",
					}),
			),
		);
	const languages = detected.paragraphs.flatMap(({ sentences }) =>
		sentences.map(({ language }) => language),
	);
	return touched.filter((index) => languages[index - first] === "de");
});

export const classifySelection = Effect.fn("classifySelection")(function* (
	input: ClassifyInput,
): Effect.fn.Return<
	ClassifyOutcome,
	ClassifyError,
	ClassifySegmenter | SegmentationCache | UnitResolver | Jev | Luna
> {
	const { selection } = input;
	if (selection.to <= selection.from)
		return yield* new ClassifyError({
			message: "Select the text to classify.",
			reason: "EmptySelection",
		});
	const scroll = scrollSentences(input.content);
	const touched = scroll.sentences.flatMap((sentence, index) =>
		overlaps(sentence.source, selection) ? [index] : [],
	);
	if (touched.length === 0)
		return yield* new ClassifyError({
			message: "The selection touches no Sentence of this Scroll.",
			reason: "NoSentence",
		});

	const segmenter = yield* ClassifySegmenter;
	const german = yield* detectGerman(scroll.sentences, touched);
	if (german.length === 0)
		return yield* new ClassifyError({
			message: "The selection holds no German Sentence.",
			reason: "NoGermanSentence",
		});

	const cache = yield* SegmentationCache;
	const keyed = yield* Effect.forEach(german, (index) => {
		const text = scroll.sentences[index]?.text ?? "";
		const key = sentenceKey(segmenter.segmenterVersion, "de", text);
		return cache.get(key).pipe(
			Effect.map((cached) => ({
				cached: Option.filter(
					cached,
					(entry) => entry.text === sentenceStitchedText(text),
				),
				index,
				key,
				text,
			})),
		);
	});
	const misses = [
		...new Map(
			keyed
				.filter(({ cached }) => Option.isNone(cached))
				.map((miss) => [miss.key, miss.text] as const),
		),
	];
	const segmentedText =
		misses.length === 0
			? []
			: (yield* operations.segment.inUnits({
					language: "de",
					paragraphs: [{ sentences: misses.map(([, text]) => text) }],
				})).paragraphs.flatMap(({ sentences }) => sentences);
	const fresh = new Map<string, SegmentedSentence>();
	for (const [position, [key]] of misses.entries()) {
		const segmented = segmentedText[position];
		if (segmented) fresh.set(key, segmented);
	}
	yield* Effect.forEach(
		fresh,
		([key, segmented]) =>
			segmented.failed ? Effect.void : cache.put(key, segmented),
		{ discard: true },
	);

	const sentences = new Map<string, PlannedSentence>();
	// A Sentence repeated in the Scroll, such as a refrain, is segmented
	// once, and each of its instances gives units of its own (#116).
	const instances = sentenceInstances(
		scroll.sentences.map(({ text }) => text),
	);
	const units: PlannedUnit[] = [];
	let failed = 0;
	for (const { cached, index, key } of keyed) {
		const sentence = scroll.sentences[index];
		const segmented = Option.isSome(cached) ? cached.value : fresh.get(key);
		if (!sentence || !segmented || segmented.failed) {
			failed++;
			continue;
		}
		if (!sentences.has(key))
			sentences.set(key, {
				neighbours: neighboursOf(scroll.sentences, index),
				segmented,
			});
		units.push(
			...coveredUnits(
				scroll,
				sentence,
				segmented,
				key,
				instances[index] ?? 0,
				selection,
			),
		);
	}

	const plan: ClassifyPlan = {
		content: input.content,
		scrollPath: input.scrollPath,
		sentences,
		units,
		...(input.userLinks === undefined
			? {}
			: { userLinks: input.userLinks }),
	};
	const resolver = yield* UnitResolver;
	const resolutions = yield* resolver.resolve(plan).pipe(
		Effect.mapError(
			(error) =>
				new ClassifyError({
					message: `Resolution failed: ${error.message}`,
					reason: "ResolutionFailed",
				}),
		),
	);
	return {
		plan,
		resolutions,
		stats: {
			cachedSentences: keyed.filter(({ cached }) => Option.isSome(cached))
				.length,
			failedSentences: failed,
			germanSentences: german.length,
			segmentedSentences: [...fresh.values()].filter(
				(segmented) => !segmented.failed,
			).length,
			touchedSentences: touched.length,
		},
	};
});
