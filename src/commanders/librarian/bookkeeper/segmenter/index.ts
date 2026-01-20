import { parseSeparatedSuffix } from "../../codecs/internal/suffix/parse";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type { CodecRules } from "../../codecs/rules";
import {
	DEFAULT_SEGMENTATION_CONFIG,
	type PageSegment,
	type SegmentationConfig,
	type SegmentationResult,
	type TextBlock,
	TextBlockKind,
} from "../types";
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
	const rawPages = segmentBlocks(blocks, config);

	// Filter out empty pages (only whitespace)
	const pages = filterEmptyPages(rawPages);

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
 * Sentence-ending punctuation marks.
 * Pages should ideally end with one of these (or a closing quote after one).
 */
const SENTENCE_ENDINGS = /[.!?]["»«"]?\s*$/;

/**
 * Punctuation that indicates mid-sentence (not a valid break point).
 */
const MID_SENTENCE_ENDINGS = /[,;:\-–—]\s*$/;

/**
 * Checks if a block ends with complete sentence.
 */
function endsWithCompleteSentence(block: TextBlock): boolean {
	const lastLine = block.lines[block.lines.length - 1];
	if (!lastLine) return true; // Empty block - allow break

	const trimmed = lastLine.trim();
	if (trimmed.length === 0) return true; // Blank line - allow break

	// Check for sentence-ending punctuation
	if (SENTENCE_ENDINGS.test(trimmed)) return true;

	// Check for mid-sentence endings - definitely not complete
	if (MID_SENTENCE_ENDINGS.test(trimmed)) return false;

	// No clear punctuation - be conservative, allow break
	return true;
}

/**
 * Determines if a page break should be created at current position.
 */
function shouldCreatePageBreak(
	currentBlocks: TextBlock[],
	currentSize: number,
	currentBlock: TextBlock,
	nextBlock: TextBlock | undefined,
	config: SegmentationConfig,
): boolean {
	// No next block - don't break, will be handled at end
	if (!nextBlock) return false;

	// Check if the last non-blank block introduces speech - prevents splitting
	// between speech intro and following dialogue even with blank lines between
	if (nextBlock.kind === TextBlockKind.Dialogue) {
		// Find last non-blank block in current page
		const lastNonBlank = [...currentBlocks]
			.reverse()
			.find((b) => b.kind !== TextBlockKind.Blank);
		if (lastNonBlank?.introducesSpeech) {
			return false;
		}
	}

	// Under target size - don't break unless at preferred point
	if (currentSize < config.targetPageSizeChars) {
		// But if we're close and next block is a heading, prefer to break
		const isNearTarget = currentSize >= config.targetPageSizeChars * 0.8;
		if (isNearTarget && isPreferredSplitPoint(nextBlock)) {
			return canSplitBetweenBlocks(currentBlock, nextBlock, config);
		}
		return false;
	}

	// Check if we would be splitting mid-sentence
	if (!endsWithCompleteSentence(currentBlock)) {
		// Don't split mid-sentence unless we're way over max
		if (currentSize < config.maxPageSizeChars * 1.5) {
			return false;
		}
		// Extreme overflow - log warning but force break
	}

	// At or over target - check if we can split
	if (canSplitBetweenBlocks(currentBlock, nextBlock, config)) {
		return true;
	}

	// Over max size - force break unless we're in quoted content
	if (currentSize >= config.maxPageSizeChars) {
		// Allow overflow for quoted content to preserve poems/songs
		if (currentBlock.isQuotedContent || nextBlock.isQuotedContent) {
			return false; // Don't force-break within quoted content
		}
		// Force break at max for non-quoted content
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
 * Filters out pages with only whitespace and re-indexes remaining pages.
 */
function filterEmptyPages(pages: PageSegment[]): PageSegment[] {
	const nonEmpty = pages.filter((p) => p.content.trim().length > 0);
	// Re-index to ensure consecutive page numbers
	return nonEmpty.map((p, i) => ({ ...p, pageIndex: i }));
}

/**
 * Quick check if content would segment into multiple pages.
 * Useful for UI decisions (e.g., showing "Make this a text" button).
 */
export function wouldSplitToMultiplePages(
	content: string,
	basename: string,
	rules: CodecRules,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): boolean {
	const basenameResult = parseSeparatedSuffix(rules, basename);
	if (basenameResult.isErr()) return false;

	const result = segmentContent(content, basenameResult.value, config);
	return result.pages.length > 1;
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
