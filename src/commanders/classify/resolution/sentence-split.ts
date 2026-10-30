/**
 * How Classify cuts a paragraph of several Sentences into sentence blocks
 * before it gives them IDs, so each Attestation embeds its own Sentence. It
 * cuts with the `^N` formatter that "Split in sentence blocks" and "Split
 * file into pages" use (`splitStrInSentenceBlocks`), so the result looks as
 * theirs does: one Sentence per block, ` ^N` after it, a blank line before
 * the next.
 *
 * The formatter's result is kept only when it is exact. Every block must be
 * a verbatim stretch of the paragraph, give or take the decoration markers
 * the formatter adds where a cut goes through emphasis, and only whitespace
 * may stand between two blocks. Classify then replaces that whitespace and
 * nothing else, so the links, decorations, hard breaks and footnotes inside
 * the Sentences stay as they were, and every offset inside a Sentence moves
 * by a known amount.
 *
 * It must also follow Classify's own Sentences (`markdownSentences`), whose
 * texts key the segmentation cache and every occurrence: a cut stands only
 * between two of them, and the cut paragraph must read as the same
 * Sentences as before. Where the formatter and Classify disagree, the
 * blocks they would part stay one.
 */
import { splitStrInSentenceBlocks } from "../../librarian/pages/segmenter/block-marker/split-str-in-sentence-blocks";
import { markdownSentences } from "../scroll-sentences";
import type { SourceRange } from "../types";

/** One sentence block of a paragraph, at offsets in the paragraph's text. */
type SentencePiece = SourceRange & {
	/** Decoration markers the cut before it opens again, such as `*`. */
	readonly prefix: string;
	/** Decoration markers the cut after it closes. */
	readonly suffix: string;
};

/** A paragraph's sentence blocks, two or more, in order. */
export type SentenceSplit = readonly SentencePiece[];

/** An edit to a text: `[from, to)` becomes `text`. */
export type TextEdit = SourceRange & { readonly text: string };

const LEADING_DECORATION = /^[*_~=]*/u;
const TRAILING_DECORATION = /[*_~=]*$/u;

/** The formatter's blocks, each without its ` ^N` and the blank line after it. */
function formattedBlocks(text: string): readonly string[] | undefined {
	const { blockCount, markedText } = splitStrInSentenceBlocks(text, 0);
	if (blockCount < 2) return undefined;
	const blocks: string[] = [];
	let position = 0;
	for (let index = 0; index < blockCount; index++) {
		const marker = ` ^${index}`;
		const at = markedText.indexOf(marker, position);
		if (at < 0) return undefined;
		blocks.push(markedText.slice(position, at));
		position = at + marker.length;
		const separator = index < blockCount - 1 ? "\n\n" : "";
		if (!markedText.startsWith(separator, position)) return undefined;
		position += separator.length;
	}
	return position === markedText.length ? blocks : undefined;
}

/**
 * Where `block` stands in `text` from `start`: the block, less the fewest
 * decoration markers at its edges that `text` lacks there.
 */
function pieceAt(
	text: string,
	start: number,
	block: string,
	edges: { readonly first: boolean; readonly last: boolean },
): SentencePiece | undefined {
	const leading = LEADING_DECORATION.exec(block)?.[0].length ?? 0;
	const trailing = TRAILING_DECORATION.exec(block)?.[0].length ?? 0;
	for (let added = 0; added <= leading + trailing; added++)
		for (let p = 0; p <= Math.min(added, leading); p++) {
			const q = added - p;
			// The paragraph's own edges gain nothing: there is no cut there.
			if (q > trailing || (edges.first && p > 0) || (edges.last && q > 0))
				continue;
			const core = block.slice(p, block.length - q);
			if (core.trim() && text.startsWith(core, start))
				return {
					from: start,
					prefix: block.slice(0, p),
					suffix: block.slice(block.length - q),
					to: start + core.length,
				};
		}
	return undefined;
}

/** The texts of the Sentences Classify reads in `markdown`. */
const sentenceTextsOf = (markdown: string) =>
	markdownSentences(markdown).sentences.map(({ text }) => text);

/**
 * The sentence blocks of a paragraph's `text`, or none when it holds one
 * Sentence or the cut is not exact. Two blocks stay one when no whitespace
 * stands between them, when no boundary between two of Classify's
 * Sentences lies between them, or when `cutAllowed` refuses the whitespace
 * between them. The whole cut is refused when the cut paragraph would read
 * as other Sentences than `text`.
 */
export function sentenceSplitOf(
	text: string,
	cutAllowed: (gap: SourceRange) => boolean,
): SentenceSplit | undefined {
	const blocks = formattedBlocks(text);
	if (!blocks) return undefined;
	const pieces: SentencePiece[] = [];
	let cursor = 0;
	for (const [index, block] of blocks.entries()) {
		let start = cursor;
		while (start < text.length && /\s/u.test(text[start] ?? "")) start++;
		const piece = pieceAt(text, start, block, {
			first: index === 0,
			last: index === blocks.length - 1,
		});
		if (!piece) return undefined;
		pieces.push(piece);
		cursor = piece.to;
	}
	if (text.slice(cursor).trim()) return undefined;
	const sentences = markdownSentences(text).sentences;
	/** Whether one of Classify's Sentences ends, and the next starts, within `gap`. */
	const atBoundary = (gap: SourceRange) =>
		sentences.some(({ source }, index) => {
			const next = sentences[index + 1];
			return (
				next !== undefined &&
				source.to <= gap.to &&
				next.source.from >= gap.from
			);
		});
	const merged: SentencePiece[] = [];
	for (const piece of pieces) {
		const previous = merged.at(-1);
		if (!previous) {
			merged.push(piece);
			continue;
		}
		const gap = { from: previous.to, to: piece.from };
		if (gap.from < gap.to && atBoundary(gap) && cutAllowed(gap))
			merged.push(piece);
		// Without the cut, the markers it needed go too.
		else
			merged[merged.length - 1] = {
				from: previous.from,
				prefix: previous.prefix,
				suffix: piece.suffix,
				to: piece.to,
			};
	}
	if (merged.length < 2) return undefined;
	const cut = applyEdits(
		text,
		sentenceSplitEdits(
			merged,
			merged.map((_, index) => String(index)),
			text.length,
			"\n",
		),
	);
	const before = sentenceTextsOf(text);
	const after = sentenceTextsOf(cut);
	return before.length === after.length &&
		before.every((sentence, index) => sentence === after[index])
		? merged
		: undefined;
}

/** `text` with `edits`, which do not overlap, applied. */
function applyEdits(text: string, edits: readonly TextEdit[]): string {
	let result = text;
	for (const edit of [...edits].sort((a, b) => b.from - a.from))
		result = result.slice(0, edit.from) + edit.text + result.slice(edit.to);
	return result;
}

/**
 * The edits that cut a paragraph of `length` characters as `split` says,
 * the blocks taking `ids` in order: the whitespace after each block becomes
 * its markers, ` ^id` and a blank line in the file's line ending `eol`;
 * after the last, ` ^id` alone.
 */
export function sentenceSplitEdits(
	split: SentenceSplit,
	ids: readonly string[],
	length: number,
	eol: string,
): readonly TextEdit[] {
	return split.map((piece, index) => {
		const next = split[index + 1];
		const marker = `${piece.suffix} ^${ids[index] ?? ""}`;
		return next
			? {
					from: piece.to,
					text: `${marker}${eol}${eol}${next.prefix}`,
					to: next.from,
				}
			: { from: piece.to, text: marker, to: length };
	});
}

/** The index of the block that holds `offset`, in the paragraph's text. */
export function pieceIndexOf(split: SentenceSplit, offset: number): number {
	const index = split.findIndex(({ to }) => offset < to);
	return index < 0 ? split.length - 1 : index;
}

/** A place `content` holds a paragraph cut: its start and its blocks' IDs. */
type FoundCut = { readonly at: number; readonly ids: readonly string[] };

/** Every place `content` holds `text` cut as `split` says, with any IDs. */
function cutsIn(
	content: string,
	text: string,
	split: SentenceSplit,
	eol: string,
): FoundCut[] {
	const pieces = split.map(
		(piece) =>
			piece.prefix + text.slice(piece.from, piece.to) + piece.suffix,
	);
	const [first] = pieces;
	if (first === undefined) return [];
	const lead = text.slice(0, split[0]?.from ?? 0);
	const found: FoundCut[] = [];
	for (
		let at = content.indexOf(lead + first);
		at >= 0;
		at = content.indexOf(lead + first, at + 1)
	) {
		if (at > 0 && content[at - 1] !== "\n") continue;
		const ids: string[] = [];
		let position = at + lead.length;
		for (const [index, piece] of pieces.entries()) {
			if (!content.startsWith(`${piece} ^`, position)) break;
			position += piece.length + 2;
			const id = /^\d+/u.exec(content.slice(position))?.[0];
			if (id === undefined) break;
			position += id.length;
			const separator = index < pieces.length - 1 ? `${eol}${eol}` : "";
			if (!content.startsWith(separator, position)) break;
			position += separator.length;
			ids.push(id);
		}
		const lineEnd = content.slice(position).match(/^\r?(?:\n|$)/u);
		if (ids.length === pieces.length && lineEnd) found.push({ at, ids });
	}
	return found;
}

/**
 * Where `current` holds the cut another run made of the snapshot's
 * paragraph `text`: the cut's start and the IDs its blocks carry. Only a
 * cut the snapshot did not hold anywhere counts, and only when `current`
 * holds exactly one: a refrain cut earlier is never taken for this one.
 */
export function findNewCut(input: {
	readonly snapshot: string;
	readonly current: string;
	readonly text: string;
	readonly split: SentenceSplit;
	readonly eol: string;
}): FoundCut | undefined {
	const { current, eol, snapshot, split, text } = input;
	if (cutsIn(snapshot, text, split, eol).length > 0) return undefined;
	const found = cutsIn(current, text, split, eol);
	return found.length === 1 ? found[0] : undefined;
}
