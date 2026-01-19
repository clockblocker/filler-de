import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type {
	Block,
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
} from "../types";
import { DEFAULT_SEGMENTATION_CONFIG } from "../types";
import { blocksCharCount, blocksToContent, parseBlocks } from "./parse-blocks";
import { canSplitBetweenBlocks, isPreferredSplitPoint } from "./rules";

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
 */
function segmentBlocks(
	blocks: Block[],
	config: SegmentationConfig,
): PageSegment[] {
	const pages: PageSegment[] = [];
	let currentPageBlocks: Block[] = [];
	let currentPageSize = 0;

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		const nextBlock = blocks[i + 1];

		// Add block to current page
		currentPageBlocks.push(block);
		currentPageSize += block.charCount;

		// Check if we should create a page break
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
	_currentBlocks: Block[],
	currentSize: number,
	currentBlock: Block,
	nextBlock: Block | undefined,
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
function createPage(blocks: Block[], pageIndex: number): PageSegment {
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
