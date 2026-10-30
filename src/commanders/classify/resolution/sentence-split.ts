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
 */
import { splitStrInSentenceBlocks } from "../../librarian/pages/segmenter/block-marker/split-str-in-sentence-blocks";
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

const LEADING_DECORATION = /^[*~=]*/u;
const TRAILING_DECORATION = /[*~=]*$/u;

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

/**
 * The sentence blocks of a paragraph's `text`, or none when it holds one
 * Sentence or the formatter's result is not exact. Two blocks with no
 * whitespace between them, or whose cut `cutAllowed` refuses, stay one.
 */
export function sentenceSplitOf(
	text: string,
	cutAllowed: (at: number) => boolean,
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
	const merged: SentencePiece[] = [];
	for (const piece of pieces) {
		const previous = merged.at(-1);
		if (
			previous &&
			(piece.from === previous.to || !cutAllowed(previous.to))
		)
			// Without the cut, the markers it needed go too.
			merged[merged.length - 1] = {
				from: previous.from,
				prefix: previous.prefix,
				suffix: piece.suffix,
				to: piece.to,
			};
		else merged.push(piece);
	}
	return merged.length < 2 ? undefined : merged;
}

/**
 * The edits that cut a paragraph of `length` characters as `split` says,
 * the blocks taking `ids` in order: the whitespace after each block becomes
 * its markers, ` ^id` and a blank line; after the last, ` ^id` alone.
 */
export function sentenceSplitEdits(
	split: SentenceSplit,
	ids: readonly string[],
	length: number,
): readonly TextEdit[] {
	return split.map((piece, index) => {
		const next = split[index + 1];
		const marker = `${piece.suffix} ^${ids[index] ?? ""}`;
		return next
			? {
					from: piece.to,
					text: `${marker}\n\n${next.prefix}`,
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
