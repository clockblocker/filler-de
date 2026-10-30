/**
 * The plugin's one sentence splitter (ADR 0014): a note's Markdown in, its
 * paragraphs and Sentences out, each Sentence placed in the note's own
 * offsets. Classify reads a Scroll's Sentences with it (`scrollSentences`)
 * and the `^N` block formatter makes each Sentence it finds a block, so a
 * block never cuts a Sentence that Classify later segments.
 *
 * The Markdown is first projected as Obsidian shows it: block markers,
 * comments, embeds and images are dropped, links keep only their shown
 * text, and `==`/`~~` markers go. Each kept character remembers its source
 * offset. Every line break inside a paragraph becomes a Markdown hard
 * break, as Obsidian renders it, so the splitter tells verse from a hard
 * wrap. dumtext's `splitMarkdown` reads and splits the projection, as
 * dumgen's `extractedTextFromMarkdown` and `splitScroll` do, and says where
 * each Sentence stands in it; the projection's offsets take that back to
 * the note.
 */
import { splitMarkdown } from "dumtext";

/** A stretch of the note, `[from, to)` in UTF-16 units. */
type Range = { readonly from: number; readonly to: number };

/** The projected Markdown and, per UTF-16 unit, the source offset it was copied from. */
export type MarkdownProjection = {
	readonly text: string;
	readonly offsets: readonly number[];
};

/** One Sentence, located both in the projection and in the source. */
export type SourceSentence = {
	/** The Sentence as dumtext gives it: trimmed, NFC, markup gone. */
	readonly text: string;
	/** Its first to its last character in the projection. */
	readonly projected: { readonly start: number; readonly end: number };
	/** Its first to its last character in the source, markup inside it included. */
	readonly source: Range;
};

/** A paragraph: a Markdown Heading, or anything else dumtext reads as one. */
type SourceParagraph = {
	readonly kind: "Heading" | "Paragraph";
	readonly sentences: readonly SourceSentence[];
};

export type MarkdownSentences = {
	readonly projection: MarkdownProjection;
	readonly paragraphs: readonly SourceParagraph[];
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
export function projectMarkdown(
	content: string,
	from: number,
	to: number,
): MarkdownProjection {
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

/** The source range of projected `[start, end)`. */
export function projectedToSource(
	projection: MarkdownProjection,
	start: number,
	end: number,
): Range {
	if (end <= start) {
		const at = projection.offsets[start] ?? projection.offsets.at(-1) ?? 0;
		return { from: at, to: at };
	}
	return {
		from: projection.offsets[start] ?? 0,
		to: (projection.offsets[end - 1] ?? 0) + 1,
	};
}

/**
 * The paragraphs and Sentences of `content[from, to)`, in reading order,
 * each Sentence located in `content`'s offsets.
 */
export function splitMarkdownSentences(
	content: string,
	from = 0,
	to = content.length,
): MarkdownSentences {
	const projection = projectMarkdown(content, from, to);
	return {
		paragraphs: splitMarkdown(projection.text).paragraphs.map(
			({ kind, sentences }) => ({
				kind,
				sentences: sentences.map(({ end, start, text }) => ({
					projected: { end, start },
					source: projectedToSource(projection, start, end),
					text,
				})),
			}),
		),
		projection,
	};
}
