/**
 * Block Marker - Orchestrator
 *
 * Splits text into sentence blocks, one Sentence each, with Obsidian block
 * markers (` ^N`). "Split in sentence blocks", "Split file into pages" and
 * Classify (before it gives a multi-Sentence paragraph its IDs) all split
 * with it, and its Sentences are the ones Classify reads
 * (`splitMarkdownSentences`).
 */

import { formatBlocksWithMarkers } from "./block-formatting";
import { healUnclosedDecorations } from "./decorations";
import { type Block, sentenceBlocksOf } from "./sentence-blocks";
import type { BlockSplitResult } from "./types";

export { formatBlocksWithMarkers } from "./block-formatting";

/**
 * Extended result that includes intermediate blocks for page accumulation.
 * This enables the unified pipeline: blocks → pages → marked pages.
 */
type BlockSplitResultWithIntermediate = BlockSplitResult & {
	/** The blocks, for page accumulation */
	blocks: readonly Block[];
};

/**
 * Strip existing block markers (` ^N`) to ensure idempotent re-marking.
 * Matches markers anywhere, not just at end of line, to handle malformed content.
 */
export function stripBlockMarkers(text: string): string {
	return text.replace(/ \^\d+/g, "");
}

/**
 * Split text into sentence blocks with Obsidian block markers: every
 * Sentence becomes a block of its own, ended by ` ^N`, with a blank line
 * before the next. No Sentence is grouped with another, however short, so
 * a block's embed shows exactly one Sentence.
 *
 * @param text - Input text to split
 * @param startIndex - Starting block ID (default 0)
 * @returns Marked text and block count
 */
export function splitStrInSentenceBlocks(
	text: string,
	startIndex = 0,
): BlockSplitResult {
	const { blockCount, markedText } = splitStrInSentenceBlocksWithIntermediate(
		text,
		startIndex,
	);
	return { blockCount, markedText };
}

/**
 * Split text into sentence blocks, keeping the blocks for page
 * accumulation. Unclosed decorations are healed first, as Obsidian reads
 * them. Text that holds no Sentence comes back trimmed, with no block.
 *
 * @param text - Input text to split
 * @param startIndex - Starting block ID (default 0)
 */
export function splitStrInSentenceBlocksWithIntermediate(
	text: string,
	startIndex = 0,
): BlockSplitResultWithIntermediate {
	const { blocks, rest } = sentenceBlocksOf(healUnclosedDecorations(text));
	return {
		blockCount: blocks.length,
		blocks,
		markedText:
			blocks.length === 0
				? rest
				: formatBlocksWithMarkers(blocks, startIndex),
	};
}
