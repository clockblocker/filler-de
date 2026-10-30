/**
 * Sentence Blocks
 *
 * Every Sentence becomes a block of its own, so every `^N` names exactly
 * one Sentence and an Attestation that embeds it shows that Sentence.
 * Nothing is grouped: not short Sentences, not direct speech, not a speech
 * intro with its quote.
 *
 * The Sentences are the plugin's one sentence splitter's
 * (`splitMarkdownSentences`), the ones Classify reads, so a block never
 * cuts a Sentence Classify segments. A block is the source as written:
 * from the start of its paragraph's first line, or from the cut before it,
 * to the cut after it, or the end of its paragraph's last line.
 *
 * - **Cuts.** Two Sentences of a paragraph are cut apart at the blanks
 *   between them: the first line break, else the last run of blanks, so
 *   `Er ging.[^1] Sie blieb.` keeps the footnote reference, and a closing
 *   `*`, with the Sentence before. A cut never goes through a link, code,
 *   a comment, HTML or math, nor right after a list item's marker, which
 *   the splitter reads as a Sentence of its own (`1.`): the Sentences
 *   around it stay one block.
 * - **Decorations.** A cut through emphasis, `~~` or `==` closes it at the
 *   end of the block before and opens it again in the block after.
 * - **What is no Sentence.** Headings, rules, fenced code, tables, math
 *   blocks, footnote definitions, embeds and comments get no block. They
 *   stay as written, before the block that follows them, or after the
 *   last block.
 */

import {
	type SourceSentence,
	splitMarkdownSentences,
} from "../../../../../stateless-helpers/markdown-sentences";
import { decorationPairs, type Range } from "./decorations";

/**
 * One block: one Sentence, or several a cut could not go between.
 */
export type Block = {
	/**
	 * What stands before the Sentence and is no Sentence, such as a
	 * heading, with the line break or blank line that joins it to the
	 * Sentence; empty when nothing does.
	 */
	readonly lead: string;
	/** The Sentence as written, with the decoration markers its cuts close and open. */
	readonly text: string;
	/** What follows the last block and is no Sentence, after a blank line; empty for any other. */
	readonly trail: string;
	/** Whether a blank line, or a `lead`, parts it from the block before. */
	readonly startsNewParagraph: boolean;
	/** Its character count, for page accumulation. */
	readonly charCount: number;
};

export type SentenceBlocks = {
	readonly blocks: readonly Block[];
	/** The text, trimmed, when it holds no Sentence a block can take. */
	readonly rest: string;
};

/** Markup a cut never goes through. */
const INLINE = new RegExp(
	[
		String.raw`!?\[\[[^\]\n]*\]\]`,
		String.raw`!?\[[^\]\n]*\]\([^)\n]*\)`,
		"`[^`\\n]*`",
		String.raw`%%[\s\S]*?%%`,
		String.raw`<!--[\s\S]*?-->`,
		String.raw`<\/?[A-Za-z][^>\n]*>`,
		String.raw`\$\$[\s\S]*?\$\$`,
	].join("|"),
	"gu",
);

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const TABLE_DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/u;
const HEADING_LINE = /^ {0,3}#{1,6}(?:[ \t]|$)/u;
const LIST_MARKER = /^(?:[-+*]|\d{1,9}[.)])$/u;
/** A nested list item's indentation, which a block that opens with it keeps. */
const LIST_ITEM_INDENT = /^[ \t]+(?=(?:[-+*]|\d{1,9}[.)])[ \t])/u;
const BLANK_LINE = /\n[ \t]*\r?\n/u;

type Line = {
	readonly from: number;
	readonly to: number;
	readonly text: string;
};

function linesOf(text: string): Line[] {
	const lines: Line[] = [];
	let from = 0;
	for (const text_ of text.split("\n")) {
		lines.push({ from, text: text_, to: from + text_.length });
		from += text_.length + 1;
	}
	return lines;
}

/** Where fenced code, tables and math blocks stand: their Sentences get no block. */
function verbatimRanges(lines: readonly Line[]): Range[] {
	const ranges: Range[] = [];
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (!line) continue;
		const fence = FENCE.exec(line.text)?.[1];
		const math = line.text.trim().startsWith("$$");
		if (fence !== undefined || math) {
			const closing =
				fence === undefined
					? /\$\$/u
					: new RegExp(
							`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`,
							"u",
						);
			let end = index + 1;
			if (math && line.text.trim().slice(2).includes("$$")) end = index;
			else
				while (
					end < lines.length &&
					!closing.test(lines[end]?.text ?? "")
				)
					end++;
			const last = lines[Math.min(end, lines.length - 1)] ?? line;
			ranges.push({ from: line.from, to: last.to });
			index = end;
			continue;
		}
		if (
			TABLE_DELIMITER_ROW.test(line.text) &&
			(lines[index - 1]?.text.includes("|") ?? false)
		) {
			let end = index;
			while (
				end + 1 < lines.length &&
				(lines[end + 1]?.text.includes("|") ?? false) &&
				(lines[end + 1]?.text.trim() ?? "") !== ""
			)
				end++;
			const header = lines[index - 1] ?? line;
			ranges.push({ from: header.from, to: lines[end]?.to ?? line.to });
			index = end;
		}
	}
	return ranges;
}

function rangesOf(text: string, pattern: RegExp): Range[] {
	return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map(
		(match) => ({ from: match.index, to: match.index + match[0].length }),
	);
}

/**
 * The first of `ranges`, sorted and apart, that ends after `at`; with a
 * binary search, as a book holds many Sentences and links.
 */
function firstEndingAfter<R extends { readonly to: number }>(
	ranges: readonly R[],
	at: number,
): R | undefined {
	let low = 0;
	let high = ranges.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if ((ranges[middle]?.to ?? 0) > at) high = middle;
		else low = middle + 1;
	}
	return ranges[low];
}

const within = (ranges: readonly Range[], at: number) =>
	(firstEndingAfter(ranges, at)?.from ?? Number.POSITIVE_INFINITY) <= at;

/**
 * Where to cut between two Sentences of a paragraph: of the runs of
 * blanks in `text[from, to)` outside markup a cut never goes through, the
 * first that holds a line break, else the last; the empty range at `to`
 * when there are no blanks. None when every run is inside such markup.
 */
function cutBetween(
	text: string,
	from: number,
	to: number,
	inline: readonly Range[],
): Range | undefined {
	const through = (cut: Range) => {
		const range = firstEndingAfter(inline, cut.from);
		if (!range) return false;
		return cut.from === cut.to
			? range.from < cut.from
			: range.from < cut.to;
	};
	const blanks = [...text.slice(from, to).matchAll(/\s+/gu)].map((match) => ({
		from: from + match.index,
		to: from + match.index + match[0].length,
	}));
	if (blanks.length === 0) {
		const at = { from: to, to };
		return through(at) ? undefined : at;
	}
	const runs = blanks.filter((run) => !through(run));
	return (
		runs.find((run) => text.slice(run.from, run.to).includes("\n")) ??
		runs.at(-1)
	);
}

/** One block being drawn: its range, and the paragraph and cut it starts with. */
type Draft = {
	from: number;
	to: number;
	readonly paragraph: number;
	/** The blanks it was cut from the block before at, when it was. */
	readonly cut: Range | undefined;
};

/** The Sentences that get blocks, each with its paragraph's index. */
function blockSentences(
	paragraphs: ReturnType<typeof splitMarkdownSentences>["paragraphs"],
	verbatim: readonly Range[],
): { readonly sentence: SourceSentence; readonly paragraph: number }[] {
	return paragraphs.flatMap(({ kind, sentences }, paragraph) =>
		kind === "Heading"
			? []
			: sentences
					.filter(
						({ source }) =>
							source.from < source.to &&
							!within(verbatim, source.from),
					)
					.map((sentence) => ({ paragraph, sentence })),
	);
}

function drafts(
	text: string,
	lines: readonly Line[],
	inline: readonly Range[],
	sentences: ReturnType<typeof blockSentences>,
): Draft[] {
	// A line holds `at` when it ends at or after it, its line break included.
	const lineOf = (at: number) =>
		firstEndingAfter(lines, at - 1) ?? { from: 0, text, to: text.length };
	const drawn: Draft[] = [];
	for (const { paragraph, sentence } of sentences) {
		const { from, to } = sentence.source;
		const last = drawn.at(-1);
		const lineStart = lineOf(from).from;
		if (last && (last.paragraph === paragraph || lineStart < last.to)) {
			const cut = cutBetween(text, last.to, from, inline);
			// `1.` is a Sentence of its own, but no block: it opens its list item.
			if (
				!cut ||
				LIST_MARKER.test(text.slice(last.from, cut.from).trim())
			) {
				last.to = to;
				continue;
			}
			last.to = cut.from;
			drawn.push({ cut, from: cut.to, paragraph: last.paragraph, to });
			continue;
		}
		drawn.push({
			cut: undefined,
			from: Math.max(lineStart, last?.to ?? 0),
			paragraph,
			to,
		});
	}
	// A paragraph's last block runs to the end of its line, closers included.
	for (const [index, draft] of drawn.entries()) {
		const next = drawn[index + 1];
		if (next?.cut) continue;
		draft.to = Math.min(lineOf(draft.to - 1).to, next?.from ?? text.length);
	}
	for (const draft of drawn) {
		while (draft.from < draft.to && /\s/u.test(text[draft.from] ?? ""))
			draft.from++;
		while (draft.to > draft.from && /\s/u.test(text[draft.to - 1] ?? ""))
			draft.to--;
		// A nested list item stays nested.
		const line = lineOf(draft.from);
		const indent = LIST_ITEM_INDENT.exec(line.text)?.[0].length ?? 0;
		if (indent > 0 && draft.from === line.from + indent)
			draft.from = line.from;
	}
	return drawn;
}

/**
 * The decoration markers each draft gains: what the cut after it closes
 * and what the cut before it opens again.
 */
function decorationEdges(
	text: string,
	drawn: readonly Draft[],
	inline: readonly Range[],
): { prefix: string; suffix: string }[] {
	const edges = drawn.map(() => ({ prefix: "", suffix: "" }));
	let start = 0;
	while (start < drawn.length) {
		let end = start + 1;
		while (end < drawn.length && drawn[end]?.cut) end++;
		const first = drawn[start];
		const last = drawn[end - 1];
		if (first && last && end - start > 1) {
			const pairs = decorationPairs(
				text,
				{ from: first.from, to: last.to },
				inline,
			);
			for (let index = start + 1; index < end; index++) {
				const cut = drawn[index]?.cut;
				const before = edges[index - 1];
				const after = edges[index];
				if (!cut || !before || !after) continue;
				const open = pairs.filter(
					(pair) =>
						pair.open.to <= cut.from && pair.close.from >= cut.to,
				);
				before.suffix += open
					.map(({ marker }) => marker)
					.reverse()
					.join("");
				after.prefix = open.map(({ marker }) => marker).join("");
			}
		}
		start = end;
	}
	return edges;
}

/** How what stands before a block joins it: a line break after a heading, else a blank line. */
function joined(before: string): string {
	const lastLine = before.slice(before.lastIndexOf("\n") + 1);
	return `${before}${HEADING_LINE.test(lastLine) ? "\n" : "\n\n"}`;
}

/** The text's sentence blocks, one per Sentence. */
export function sentenceBlocksOf(text: string): SentenceBlocks {
	const lines = linesOf(text);
	const inline = rangesOf(text, INLINE);
	const { paragraphs } = splitMarkdownSentences(text);
	const drawn = drafts(
		text,
		lines,
		inline,
		blockSentences(paragraphs, verbatimRanges(lines)),
	);
	if (drawn.length === 0) return { blocks: [], rest: text.trim() };
	const edges = decorationEdges(text, drawn, inline);
	const blocks = drawn.map((draft, index): Block => {
		const previousEnd = drawn[index - 1]?.to ?? 0;
		const gap = text.slice(previousEnd, draft.from);
		const before = gap.trim();
		const lead = before ? joined(before) : "";
		const after =
			index === drawn.length - 1 ? text.slice(draft.to).trim() : "";
		const trail = after ? `\n\n${after}` : "";
		const edge = edges[index] ?? { prefix: "", suffix: "" };
		const sentence = `${edge.prefix}${text.slice(draft.from, draft.to)}${edge.suffix}`;
		return {
			charCount: lead.length + sentence.length + trail.length,
			lead,
			startsNewParagraph:
				index > 0 && (before !== "" || BLANK_LINE.test(gap)),
			text: sentence,
			trail,
		};
	});
	return { blocks, rest: "" };
}
