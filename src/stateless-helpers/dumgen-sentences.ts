/**
 * The plugin's one sentence splitter: dumgen's `splitText` (ADR 0014). The
 * `^N` block formatter groups the Sentences it finds, and Classify finds
 * the Sentences a selection touches with it, so a block never cuts a
 * Sentence that Classify later segments.
 *
 * dumgen returns Sentences as trimmed strings. It drops only whitespace,
 * joins a hard-wrapped line with a space and normalizes to NFC, so each
 * Sentence is located in its source by matching it cluster by cluster while
 * ignoring whitespace. `alignText` does that matching and also tolerates
 * source characters the target lacks, such as Markdown markup that dumgen's
 * Markdown reader dropped.
 */
import { extractPastedText, splitScroll } from "dumgen";

/** dumgen's paragraphs of plain text, each a list of trimmed Sentences. */
export function splitPlainText(text: string): readonly (readonly string[])[] {
	return splitScroll(extractPastedText(text)).paragraphs.map(
		({ sentences }) => sentences,
	);
}

/** Where a target string sits in its source: the source offsets per target code unit. */
export type TextAlignment = {
	/** Source offset of the target's first non-whitespace character. */
	readonly start: number;
	/** Source offset just past the target's last non-whitespace character. */
	readonly end: number;
	/**
	 * For each UTF-16 code unit of the target, the source range it came
	 * from. Whitespace, and characters the source lacks, get an empty range
	 * at the position reached so far.
	 */
	readonly starts: readonly number[];
	readonly ends: readonly number[];
};

/** A source character the target lacks is skipped; at most this many in a row. */
const LOOKAHEAD_CLUSTERS = 64;
const combiningMark = /\p{M}/u;
const whitespace = /^\s+$/u;

function clusterEnd(text: string, index: number): number {
	const first = text.codePointAt(index) ?? 0;
	let end = index + (first > 0xffff ? 2 : 1);
	while (end < text.length) {
		if (text.charCodeAt(end) < 0x300) break;
		const next = String.fromCodePoint(text.codePointAt(end) ?? 0);
		if (!combiningMark.test(next)) break;
		end += next.length;
	}
	return end;
}

function clusterText(text: string, start: number, end: number): string {
	return end - start === 1
		? (text[start] ?? "")
		: text.slice(start, end).normalize("NFC");
}

/**
 * The next source cluster equal to `wanted` at or after `from`: whitespace
 * is skipped freely, and up to `LOOKAHEAD_CLUSTERS` other clusters the
 * target lacks. Undefined when none is found.
 */
function findCluster(
	source: string,
	wanted: string,
	from: number,
	limit: number,
): { readonly start: number; readonly end: number } | undefined {
	let position = from;
	let skipped = 0;
	while (position < limit) {
		const end = clusterEnd(source, position);
		const text = clusterText(source, position, end);
		if (text === wanted) return { end, start: position };
		if (!whitespace.test(text) && ++skipped > LOOKAHEAD_CLUSTERS) return;
		position = end;
	}
	return;
}

/**
 * Aligns `target` with `source` from offset `from`, or undefined when not
 * one of the target's non-whitespace characters is found.
 */
export function alignText(
	source: string,
	target: string,
	from = 0,
	limit = source.length,
): TextAlignment | undefined {
	const starts: number[] = new Array(target.length);
	const ends: number[] = new Array(target.length);
	let position = from;
	let start: number | undefined;
	let end = from;
	let index = 0;
	while (index < target.length) {
		const next = clusterEnd(target, index);
		const text = clusterText(target, index, next);
		const hit = whitespace.test(text)
			? undefined
			: findCluster(source, text, position, limit);
		for (let unit = index; unit < next; unit++) {
			starts[unit] = hit?.start ?? position;
			ends[unit] = hit?.end ?? position;
		}
		if (hit) {
			start ??= hit.start;
			end = hit.end;
			position = hit.end;
		}
		index = next;
	}
	if (start === undefined) return;
	return { end, ends, start, starts };
}

/** One Sentence and the source range of its first to its last non-whitespace character. */
export type LocatedSentence = {
	readonly text: string;
	readonly start: number;
	readonly end: number;
};

/**
 * Locates Sentences, in order, in the source they were split from. A
 * Sentence that cannot be found gets an empty range where the previous one
 * ended.
 */
export function locateSentences(
	source: string,
	sentences: readonly string[],
	from = 0,
): LocatedSentence[] {
	let position = from;
	return sentences.map((text) => {
		const alignment = alignText(source, text, position);
		if (!alignment) return { end: position, start: position, text };
		position = alignment.end;
		return { end: alignment.end, start: alignment.start, text };
	});
}
