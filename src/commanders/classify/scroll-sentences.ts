/**
 * A Scroll's Sentences as Classify sees them, each placed in the editor's
 * offsets. The Scroll's body (no frontmatter, go-back link or metadata
 * section) goes through the plugin's one sentence splitter
 * (`splitMarkdownSentences`), the one the `^N` block formatter cuts with,
 * and Classify reads every Sentence it finds, a Heading's included.
 */
import { alignText } from "../../stateless-helpers/align-text";
import {
	type MarkdownProjection,
	projectedToSource,
	type SourceSentence,
	splitMarkdownSentences,
} from "../../stateless-helpers/markdown-sentences";
import { scrollBodyRange } from "../../stateless-helpers/scroll-body-range";
import type { SourceRange } from "./types";

/** One Sentence of the Scroll, located both in the projection and in the source. */
export type ScrollSentence = SourceSentence;

export type ScrollSentences = {
	readonly projection: MarkdownProjection;
	readonly sentences: readonly ScrollSentence[];
};

/** The Scroll's Sentences in reading order, located in the editor's offsets. */
export function scrollSentences(content: string): ScrollSentences {
	const body = scrollBodyRange(content);
	return sentencesIn(content, body.from, body.to);
}

/**
 * The Sentences Classify reads in a stretch of Markdown, such as one
 * paragraph, taken as a whole: no frontmatter or go-back link is skipped.
 */
export function markdownSentences(markdown: string): ScrollSentences {
	return sentencesIn(markdown, 0, markdown.length);
}

function sentencesIn(
	content: string,
	from: number,
	to: number,
): ScrollSentences {
	const { paragraphs, projection } = splitMarkdownSentences(
		content,
		from,
		to,
	);
	return {
		projection,
		sentences: paragraphs.flatMap(({ sentences }) => sentences),
	};
}

/**
 * The source range of each Segment of a Segmented Sentence whose text was
 * aligned from the Sentence's projected start. Whitespace and characters
 * the source lacks give an empty range.
 */
export function segmentSourceRanges(
	scroll: ScrollSentences,
	sentence: ScrollSentence,
	segments: readonly { readonly text: string }[],
): readonly SourceRange[] {
	const stitched = segments.map(({ text }) => text).join("");
	const alignment = alignText(
		scroll.projection.text,
		stitched,
		sentence.projected.start,
	);
	let position = 0;
	return segments.map(({ text }) => {
		const start = position;
		position += text.length;
		if (!alignment)
			return { from: sentence.source.from, to: sentence.source.from };
		let from: number | undefined;
		let to = 0;
		for (let unit = start; unit < position; unit++) {
			const unitStart = alignment.starts[unit] ?? 0;
			const unitEnd = alignment.ends[unit] ?? 0;
			if (unitEnd <= unitStart) continue;
			const range = projectedToSource(
				scroll.projection,
				unitStart,
				unitEnd,
			);
			from = from === undefined ? range.from : Math.min(from, range.from);
			to = Math.max(to, range.to);
		}
		if (from === undefined) {
			const at = projectedToSource(
				scroll.projection,
				alignment.starts[start] ?? 0,
				alignment.starts[start] ?? 0,
			).from;
			return { from: at, to: at };
		}
		return { from, to };
	});
}
