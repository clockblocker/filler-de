/**
 * Aligns a string with the source it was read from, cluster by cluster,
 * ignoring whitespace and tolerating source characters the string lacks,
 * such as Markdown markup a reader dropped. Classify places each Segment
 * of a Segmented Sentence in the Scroll with it (`segmentSourceRanges`):
 * dumgen gives Segments as text, with no offsets.
 */

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
	// NFC changes even a lone character, such as Ω (U+2126) into Ω (U+03A9).
	return end - start === 1 && text.charCodeAt(start) < 0x80
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
