/**
 * Which unit occurrence a range of a Scroll covers, keyed as Classify keys
 * it (`occurrenceKeyOf`): from its Sentence's cached segmentation, the unit
 * its Segments belong to and the instance of the Sentence's text. The
 * unlink observer asks it which occurrence each remaining link is (#116);
 * a click on a unit link will ask it which occurrence was clicked (#281).
 *
 * Nothing is segmented here: a Sentence whose segmentation the cache does
 * not hold, for its text as it is now, gives no occurrence.
 */
import type { SegmentedSentence } from "dumgen";
import { Effect, Option } from "effect";
import {
	type ScrollSentence,
	type ScrollSentences,
	scrollSentences,
	segmentSourceRanges,
} from "../scroll-sentences";
import type { SegmentationCache } from "../segmentation-cache";
import {
	sentenceInstances,
	sentenceKey,
	sentenceStitchedText,
} from "../sentence-key";
import type { SourceRange } from "../types";
import { occurrenceKeyOf } from "./scroll-links";

/** One unit occurrence, as Classify keyed it. */
export type KeyedOccurrence = {
	/** Its Sentence's Segmentation Cache key. */
	readonly sentenceKey: string;
	/** Its unit's Segments in that Sentence. */
	readonly segments: readonly number[];
	/** Which instance of its Sentence's text it stands in. */
	readonly instance: number;
	/** Its occurrence key, an Attestation Ref's alias. */
	readonly occurrence: string;
};

/** A Sentence's Segmentation Cache key and the segmentation cached under it. */
export type CachedSentence = {
	readonly key: string;
	readonly segmented: SegmentedSentence;
};

/**
 * A Sentence's cached segmentation and key, when the cache holds one for
 * its text as it is now.
 */
export const cachedSentence = Effect.fnUntraced(function* (
	sentence: Pick<ScrollSentence, "text">,
	cache: Pick<SegmentationCache["Service"], "get">,
	segmenterVersion: string,
): Effect.fn.Return<Option.Option<CachedSentence>> {
	const key = sentenceKey(segmenterVersion, "de", sentence.text);
	const cached = Option.filter(
		yield* cache.get(key),
		(entry) => entry.text === sentenceStitchedText(sentence.text),
	);
	return Option.map(cached, (segmented) => ({ key, segmented }));
});

/**
 * The occurrence `range` covers in its Sentence: undefined where it lies
 * in no Sentence, the Sentence's segmentation is not cached, or the range
 * covers no unit's Segments, or more than one unit's, or only some of a
 * unit's Segments outside it.
 */
function occurrenceIn(
	scroll: ScrollSentences,
	sentence: ScrollSentence,
	instance: number,
	cached: Option.Option<CachedSentence>,
	range: SourceRange,
): KeyedOccurrence | undefined {
	if (Option.isNone(cached)) return;
	const { key, segmented } = cached.value;
	const ranges = segmentSourceRanges(scroll, sentence, segmented.segments);
	const covered = segmented.segments.flatMap((segment, at) => {
		const source = ranges[at];
		return segment.kind !== "Whitespace" &&
			source !== undefined &&
			source.from < source.to &&
			range.from <= source.from &&
			source.to <= range.to
			? [at]
			: [];
	});
	const units = segmented.units.filter((unit) =>
		covered.some((at) => unit.segments.includes(at)),
	);
	const [unit] = units;
	if (
		covered.length === 0 ||
		units.length !== 1 ||
		!unit ||
		!covered.every((at) => unit.segments.includes(at))
	)
		return;
	const segments = [...unit.segments];
	return {
		instance,
		occurrence: occurrenceKeyOf({ segments, sentenceKey: key }, instance),
		segments,
		sentenceKey: key,
	};
}

/**
 * The occurrence each of `ranges` covers in the Scroll's `content`, by the
 * range's start; undefined for one that covers none `occurrenceIn` can
 * tell. Each Sentence's cache entry is read once.
 */
export const occurrencesAt = Effect.fnUntraced(function* (
	content: string,
	ranges: readonly SourceRange[],
	cache: Pick<SegmentationCache["Service"], "get">,
	segmenterVersion: string,
) {
	const scroll = scrollSentences(content);
	const instances = sentenceInstances(
		scroll.sentences.map(({ text }) => text),
	);
	const read = new Map<number, Option.Option<CachedSentence>>();
	const found = new Map<number, KeyedOccurrence | undefined>();
	for (const range of ranges) {
		found.set(range.from, undefined);
		const index = scroll.sentences.findIndex(
			({ source }) => source.from <= range.from && range.to <= source.to,
		);
		const sentence = scroll.sentences[index];
		if (!sentence) continue;
		let cached = read.get(index);
		if (cached === undefined) {
			cached = yield* cachedSentence(sentence, cache, segmenterVersion);
			read.set(index, cached);
		}
		found.set(
			range.from,
			occurrenceIn(
				scroll,
				sentence,
				instances[index] ?? 0,
				cached,
				range,
			),
		);
	}
	return found;
});

/** How many cached segmentations `rememberedReads` keeps. */
const REMEMBERED_SEGMENTATIONS = 2_000;

/**
 * The cache's reads, remembered: an entry is the segmentation of its key
 * and never changes, so a hit is kept while it is among the latest
 * `capacity` read; a miss is kept until `forgetMisses`, as Classify may
 * fill it meanwhile.
 */
export function rememberedReads(
	cache: SegmentationCache["Service"],
	capacity = REMEMBERED_SEGMENTATIONS,
): Pick<SegmentationCache["Service"], "get"> & {
	readonly forgetMisses: () => void;
} {
	const hits = new Map<string, SegmentedSentence>();
	const misses = new Set<string>();
	return {
		forgetMisses: () => misses.clear(),
		get: (key) =>
			Effect.suspend(() => {
				const hit = hits.get(key);
				if (hit) {
					hits.delete(key);
					hits.set(key, hit);
					return Effect.succeedSome(hit);
				}
				if (misses.has(key)) return Effect.succeedNone;
				return Effect.tap(cache.get(key), (read) =>
					Effect.sync(() => {
						if (Option.isNone(read)) {
							misses.add(key);
							return;
						}
						hits.set(key, read.value);
						const oldest = hits.keys().next();
						if (hits.size > capacity && !oldest.done)
							hits.delete(oldest.value);
					}),
				);
			}),
	};
}
