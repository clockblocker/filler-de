/**
 * A Scroll's Sentences as Classify sees them, each placed in the editor's
 * offsets.
 *
 * The Scroll's body (no frontmatter, go-back link or metadata section) is
 * first projected: block markers, comments, embeds and images are dropped,
 * links keep only their shown text, and `==`/`~~` markers go. Each kept
 * character remembers its source offset. Every line break inside a
 * paragraph becomes a Markdown hard break, as Obsidian renders it, so
 * dumgen's `splitText` tells verse from a hard wrap exactly as it does for
 * the `^N` block formatter. dumgen's Markdown reader turns the projection
 * into Extracted Text, `splitScroll` splits each of its Scrolls into
 * Sentences, and every Sentence is aligned back to the projection, skipping
 * the markup the reader dropped, footnote references included.
 */
import { extractedTextFromMarkdown, type Scroll, splitScroll } from "dumgen";
import {
	alignText,
	type LocatedSentence,
	locateSentences,
} from "../../stateless-helpers/dumgen-sentences";
import { scrollBodyRange } from "../../stateless-helpers/scroll-body-range";
import type { SourceRange } from "./types";

/** The projected Markdown and, per UTF-16 unit, the source offset it was copied from. */
export type ScrollProjection = {
	readonly text: string;
	readonly offsets: readonly number[];
};

/** One Sentence of the Scroll, located both in the projection and in the source. */
export type ScrollSentence = {
	readonly text: string;
	readonly projected: LocatedSentence;
	readonly source: SourceRange;
};

export type ScrollSentences = {
	readonly projection: ScrollProjection;
	readonly sentences: readonly ScrollSentence[];
};

/**
 * What the projection drops or reduces to its shown text. Group 1 is a
 * wikilink's target, group 2 its alias, group 3 a Markdown link's text.
 */
const MARKUP = new RegExp(
	[
		String.raw`%%[\s\S]*?%%`,
		String.raw`<!--[\s\S]*?-->`,
		String.raw`!\[\[[^\]\n]*\]\]`,
		String.raw`!\[[^\]\n]*\]\([^)\n]*\)`,
		String.raw`\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]`,
		String.raw`\[([^\]\n]*)\]\([^)\n]*\)`,
		String.raw`[ \t]+\^[A-Za-z0-9-]+(?=[ \t]*(?:\r?\n|$))`,
		"==|~~",
	].join("|"),
	"gu",
);

/** The part of a wikilink Obsidian shows: its alias, else its target before any `#`. */
function shownWikilinkText(
	match: RegExpExecArray,
): { readonly text: string; readonly at: number } | undefined {
	const [whole, target, alias] = match;
	if (alias !== undefined)
		return { at: match.index + whole.indexOf("|") + 1, text: alias };
	if (target === undefined) return;
	const hash = target.indexOf("#");
	return {
		at: match.index + 2,
		text: hash < 0 ? target : target.slice(0, hash),
	};
}

/** Projects `content[from, to)`, keeping each kept character's source offset. */
export function projectScrollMarkdown(
	content: string,
	from: number,
	to: number,
): ScrollProjection {
	const body = content.slice(from, to);
	let text = "";
	const offsets: number[] = [];
	const keep = (piece: string, at: number) => {
		for (let index = 0; index < piece.length; index++) {
			const char = piece[index] ?? "";
			const offset = from + at + index;
			// A CRLF's `\r` is dropped, so the hard break lands before the `\n`.
			if (char === "\r" && piece[index + 1] === "\n") continue;
			const previous = text.at(-1);
			if (
				char === "\n" &&
				previous !== undefined &&
				previous !== "\n" &&
				!text.endsWith("\\") &&
				!text.endsWith("  ")
			) {
				// Two trailing spaces make a hard break; they map to the line break.
				text += "  ";
				offsets.push(offset, offset);
			}
			text += char;
			offsets.push(offset);
		}
	};
	let copied = 0;
	MARKUP.lastIndex = 0;
	for (let match = MARKUP.exec(body); match; match = MARKUP.exec(body)) {
		keep(body.slice(copied, match.index), copied);
		const [whole, target, alias, linkText] = match;
		if (target !== undefined || alias !== undefined) {
			const shown = shownWikilinkText(match);
			if (shown) keep(shown.text, shown.at);
		} else if (linkText !== undefined) keep(linkText, match.index + 1);
		copied = match.index + whole.length;
	}
	keep(body.slice(copied), copied);
	return { offsets, text };
}

/** Every Scroll of an Extracted Text, Sections opened, in reading order. */
function scrollsOf(
	contents: ReturnType<typeof extractedTextFromMarkdown>["contents"],
): Scroll[] {
	return contents.flatMap((item) =>
		item.kind === "Scroll" ? [item] : scrollsOf(item.contents),
	);
}

/** The source range of projected `[start, end)`. */
function sourceRangeOf(
	projection: ScrollProjection,
	start: number,
	end: number,
): SourceRange {
	if (end <= start) {
		const at = projection.offsets[start] ?? projection.offsets.at(-1) ?? 0;
		return { from: at, to: at };
	}
	return {
		from: projection.offsets[start] ?? 0,
		to: (projection.offsets[end - 1] ?? 0) + 1,
	};
}

/** The Scroll's Sentences in reading order, located in the editor's offsets. */
export function scrollSentences(content: string): ScrollSentences {
	const body = scrollBodyRange(content);
	const projection = projectScrollMarkdown(content, body.from, body.to);
	const texts = scrollsOf(
		extractedTextFromMarkdown(projection.text).contents,
	).flatMap((scroll) =>
		splitScroll(scroll).paragraphs.flatMap(({ sentences }) => sentences),
	);
	const located = locateSentences(projection.text, texts);
	return {
		projection,
		sentences: located.map((projected) => ({
			projected,
			source: sourceRangeOf(projection, projected.start, projected.end),
			text: projected.text,
		})),
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
			const range = sourceRangeOf(scroll.projection, unitStart, unitEnd);
			from = from === undefined ? range.from : Math.min(from, range.from);
			to = Math.max(to, range.to);
		}
		if (from === undefined) {
			const at = sourceRangeOf(
				scroll.projection,
				alignment.starts[start] ?? 0,
				alignment.starts[start] ?? 0,
			).from;
			return { from: at, to: at };
		}
		return { from, to };
	});
}
