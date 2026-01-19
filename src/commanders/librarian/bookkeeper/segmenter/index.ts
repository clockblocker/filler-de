import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type {
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
	TextBlock,
} from "../types";
import { DEFAULT_SEGMENTATION_CONFIG } from "../types";
import { blocksCharCount, blocksToContent, parseBlocks } from "./parse-blocks";
import { canSplitBetweenBlocks, isPreferredSplitPoint } from "./rules";
import {
	canSplitBlock,
	splitBlockAtSentenceBoundary,
} from "./sentence-splitter";

/**
 * Segments markdown content into pages.
 *
 * @param content - The markdown content to segment
 * @param sourceBasenameInfo - Parsed basename info (coreName + suffixParts)
 * @param config - Segmentation configuration
 * @returns Segmentation result with pages and metadata
 */
export function segmentContent(
	content: string,
	sourceBasenameInfo: SeparatedSuffixedBasename,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): SegmentationResult {
	const { coreName, suffixParts } = sourceBasenameInfo;

	// Check if content is too short to split
	if (content.length < config.minContentSizeChars) {
		return {
			pages: [
				{
					charCount: content.length,
					content,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	const blocks = parseBlocks(content);
	const pages = segmentBlocks(blocks, config);

	return {
		pages,
		sourceCoreName: coreName,
		sourceSuffix: suffixParts,
		tooShortToSplit: false,
	};
}

/**
 * Segments blocks into pages using the configured rules.
 * Uses Intl.Segmenter for sentence-level splitting when blocks exceed target.
 */
function segmentBlocks(
	blocks: TextBlock[],
	config: SegmentationConfig,
): PageSegment[] {
	const pages: PageSegment[] = [];
	let currentPageBlocks: TextBlock[] = [];
	let currentPageSize = 0;

	for (const [i, block] of blocks.entries()) {
		// Check if adding this block would exceed target and block can be split
		const wouldExceedTarget =
			currentPageSize + block.charCount > config.targetPageSizeChars;

		if (wouldExceedTarget && canSplitBlock(block)) {
			// Calculate remaining space on current page
			const remainingSpace = config.targetPageSizeChars - currentPageSize;
			// Split block at sentence boundaries using remaining space as target
			const subBlocks = splitBlockAtSentenceBoundary(
				block,
				Math.max(remainingSpace, config.targetPageSizeChars / 2),
			);

			// Process each sub-block through normal flow
			for (const [j, subBlock] of subBlocks.entries()) {
				const nextSubBlock = subBlocks[j + 1];
				const nextOriginalBlock = blocks[i + 1];
				const nextBlock = nextSubBlock ?? nextOriginalBlock;

				currentPageBlocks.push(subBlock);
				currentPageSize += subBlock.charCount;

				const shouldBreak = shouldCreatePageBreak(
					currentPageBlocks,
					currentPageSize,
					subBlock,
					nextBlock,
					config,
				);

				if (shouldBreak && currentPageBlocks.length > 0) {
					pages.push(createPage(currentPageBlocks, pages.length));
					currentPageBlocks = [];
					currentPageSize = 0;
				}
			}
		} else {
			// Normal flow: add block and check for page break
			const nextBlock = blocks[i + 1];

			currentPageBlocks.push(block);
			currentPageSize += block.charCount;

			const shouldBreak = shouldCreatePageBreak(
				currentPageBlocks,
				currentPageSize,
				block,
				nextBlock,
				config,
			);

			if (shouldBreak && currentPageBlocks.length > 0) {
				pages.push(createPage(currentPageBlocks, pages.length));
				currentPageBlocks = [];
				currentPageSize = 0;
			}
		}
	}

	// Don't forget remaining blocks
	if (currentPageBlocks.length > 0) {
		pages.push(createPage(currentPageBlocks, pages.length));
	}

	return pages;
}

/**
 * Determines if a page break should be created at current position.
 */
function shouldCreatePageBreak(
	_currentBlocks: TextBlock[],
	currentSize: number,
	currentBlock: TextBlock,
	nextBlock: TextBlock | undefined,
	config: SegmentationConfig,
): boolean {
	// No next block - don't break, will be handled at end
	if (!nextBlock) return false;

	// Under target size - don't break unless at preferred point
	if (currentSize < config.targetPageSizeChars) {
		// But if we're close and next block is a heading, prefer to break
		const isNearTarget = currentSize >= config.targetPageSizeChars * 0.8;
		if (isNearTarget && isPreferredSplitPoint(nextBlock)) {
			return canSplitBetweenBlocks(currentBlock, nextBlock, config);
		}
		return false;
	}

	// At or over target - check if we can split
	if (canSplitBetweenBlocks(currentBlock, nextBlock, config)) {
		return true;
	}

	// Over max size - force break at next allowed point
	if (currentSize >= config.maxPageSizeChars) {
		// Even if rules don't allow, we must break at max
		// Log warning in production
		return true;
	}

	// Continue accumulating
	return false;
}

/**
 * Creates a PageSegment from blocks.
 */
function createPage(blocks: TextBlock[], pageIndex: number): PageSegment {
	return {
		charCount: blocksCharCount(blocks),
		content: blocksToContent(blocks),
		pageIndex,
	};
}

/**
 * Re-exports for convenience.
 */
export { blocksCharCount, blocksToContent, parseBlocks } from "./parse-blocks";
export {
	canSplitBetweenBlocks,
	isPreferredSplitPoint,
	type SegmentationRule,
} from "./rules";
