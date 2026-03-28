/**
 * Block Page Accumulator
 *
 * Groups blocks into pages respecting size limits.
 * Blocks are treated as atomic units - never split across pages.
 * This enables the unified pipeline: blocks → pages → marked pages.
 */

import type { SegmentationConfig } from "../../types";
import type { Block } from "../block-marker/block-grouping";

/**
 * A group of blocks to be formatted as a single page.
 */
export type BlockPageGroup = {
	blocks: Block[];
	/** Total character count of all blocks */
	charCount: number;
};

/**
 * Checks if we should break the page after adding a block.
 * Blocks are always atomic (never splittable), so we use simpler logic
 * than the sentence-group accumulator.
 *
 * Logic mirrors SentenceGroup-based shouldBreakPage:
 * - Below target: keep accumulating
 * - At or above target: break, unless next block would still be under max*1.5
 *   (this allows completing a "group" that would otherwise be orphaned)
 * - At or above max: always break
 */
function shouldBreakPageForBlock(
	currentSize: number,
	nextBlock: Block | undefined,
	config: SegmentationConfig,
): boolean {
	if (!nextBlock) return false;
	if (currentSize < config.targetPageSizeChars) return false;

	// Hard limit - always break
	if (currentSize >= config.maxPageSizeChars) {
		return true;
	}

	// At or above target but below max: break by default
	// This is the key difference from the original buggy logic
	return true;
}

/**
 * Groups blocks into pages respecting size limits.
 * Blocks are atomic units - they never break across pages.
 *
 * @param blocks - Blocks from splitStrInBlocksWithIntermediate
 * @param config - Segmentation configuration
 * @returns Array of block groups, one per page
 */
export function groupBlocksIntoPages(
	blocks: Block[],
	config: SegmentationConfig,
): BlockPageGroup[] {
	if (blocks.length === 0) return [];

	const pages: BlockPageGroup[] = [];
	let currentPageBlocks: Block[] = [];
	let currentPageSize = 0;

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (!block) continue;

		currentPageBlocks.push(block);
		currentPageSize += block.charCount;

		const nextBlock = blocks[i + 1];
		if (shouldBreakPageForBlock(currentPageSize, nextBlock, config)) {
			pages.push({
				blocks: currentPageBlocks,
				charCount: currentPageSize,
			});
			currentPageBlocks = [];
			currentPageSize = 0;
		}
	}

	// Flush remaining blocks
	if (currentPageBlocks.length > 0) {
		pages.push({
			blocks: currentPageBlocks,
			charCount: currentPageSize,
		});
	}

	return pages;
}
