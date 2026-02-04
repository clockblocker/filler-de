/**
 * Block Marker - Orchestrator
 *
 * Splits text into blocks with Obsidian block markers (` ^N`).
 * This is the main entry point that chains the pipeline stages.
 */

import {
	offsetMapperHelper,
	type RemovedItem,
	type ReplacedItem,
} from "../../../../../stateless-helpers/offset-mapper";
import { annotateSentences } from "../stream/context-annotator";
import {
	healUnclosedDecorations,
	restoreDecorations,
	stripDecorations,
} from "../stream/decoration-stripper";
import { scanLines } from "../stream/line-scanner";
import { protectMarkdownSyntax } from "../stream/markdown-protector";
import { segmentSentences } from "../stream/sentence-segmenter";
import {
	type FormatContext,
	formatBlocksWithMarkers,
	restoreBlocksContent,
} from "./block-formatting";
import {
	detectParagraphsAfterFilter,
	groupSentencesIntoBlocks,
	mergeOrphanedMarkers,
} from "./block-grouping";
import {
	type ExtractedHeading,
	extractHeadings,
	filterHeadingsFromText,
} from "./heading-extraction";
import type { CodeBlockInfo, HorizontalRuleInfo } from "./heading-insertion";
import { isCodeBlock, isHorizontalRule } from "./text-patterns";
import {
	type BlockMarkerConfig,
	type BlockSplitResult,
	DEFAULT_BLOCK_MARKER_CONFIG,
} from "./types";

export {
	type FormatContext,
	formatBlocksWithMarkers,
} from "./block-formatting";
export type { Block } from "./block-grouping";
// Re-export types that are part of public API
export type { ExtractedHeading } from "./heading-extraction";
export { extractHeadings, filterHeadingsFromText } from "./heading-extraction";
export { findPrecedingHeading } from "./heading-insertion";
export type { BlockMarkerConfig, BlockSplitResult } from "./types";
export { DEFAULT_BLOCK_MARKER_CONFIG } from "./types";

/**
 * Extended result that includes intermediate blocks for page accumulation.
 * This enables the unified pipeline: blocks → pages → marked pages.
 */
export type BlockSplitResultWithIntermediate = {
	/** Text with block markers appended */
	markedText: string;
	/** Number of blocks created */
	blockCount: number;
	/** Intermediate block representation for page accumulation */
	blocks: import("./block-grouping").Block[];
	/** Context needed for formatting blocks with headings/HRs */
	formatContext: FormatContext;
};

/**
 * Strip existing block markers (` ^N`) to ensure idempotent re-marking.
 * Matches markers anywhere, not just at end of line, to handle malformed content.
 */
export function stripBlockMarkers(text: string): string {
	return text.replace(/ \^\d+/g, "");
}

/**
 * Create offset map from headings for the offset mapper.
 */
function headingsToRemovedItems(headings: ExtractedHeading[]): RemovedItem[] {
	return headings.map((h) => ({
		endOffset: h.endOffset,
		startOffset: h.startOffset,
	}));
}

/**
 * Split text into blocks with Obsidian block markers.
 *
 * Rules:
 * - Direct speech stays in one block
 * - Short sentences (≤4 words) merge with next in same paragraph (else prev)
 * - Short speech intro (≤4 words + ":") merges with following quote
 * - Merged blocks cannot exceed 30 words
 *
 * @param text - Input text to split
 * @param startIndex - Starting block ID (default 0)
 * @param config - Configuration options
 * @returns Marked text and block count
 */
export function splitStrInBlocks(
	text: string,
	startIndex = 0,
	config: Partial<BlockMarkerConfig> = {},
): BlockSplitResult {
	const result = splitStrInBlocksWithIntermediate(text, startIndex, config);
	return {
		blockCount: result.blockCount,
		markedText: result.markedText,
	};
}

/**
 * Split text into blocks with intermediate data for page accumulation.
 *
 * This is the unified pipeline entry point that:
 * 1. Runs sentence segmentation once
 * 2. Groups into blocks
 * 3. Returns both the formatted result AND intermediate blocks
 *
 * Use this when you need to further group blocks into pages.
 *
 * @param text - Input text to split
 * @param startIndex - Starting block ID (default 0)
 * @param config - Configuration options
 * @returns Extended result with blocks and formatContext for page accumulation
 */
export function splitStrInBlocksWithIntermediate(
	text: string,
	startIndex = 0,
	config: Partial<BlockMarkerConfig> = {},
): BlockSplitResultWithIntermediate {
	const fullConfig: BlockMarkerConfig = {
		...DEFAULT_BLOCK_MARKER_CONFIG,
		...config,
	};

	// Skip empty or whitespace-only text
	if (!text.trim()) {
		return {
			blockCount: 0,
			blocks: [],
			formatContext: {
				codeBlocks: [],
				headings: [],
				horizontalRules: [],
				offsetMap: (n: number) => n,
				protectedItems: [],
				protectedToFiltered: (n: number) => n,
			},
			markedText: "",
		};
	}

	// Pre-process: Heal unclosed decorations (Obsidian treats *text same as *text*)
	const healedText = healUnclosedDecorations(text);

	// Stage 1: Scan lines to detect headings and other line metadata
	const lines = scanLines(healedText, fullConfig.languageConfig);

	// Extract headings for later reinsertion
	const headings = extractHeadings(lines);

	// Filter out heading content before sentence segmentation
	const filteredText = filterHeadingsFromText(healedText, headings);

	// Protect markdown syntax (URLs, wikilinks, etc.) before segmentation
	const { safeText, protectedItems } = protectMarkdownSyntax(filteredText);

	// Strip decorations (*, **, ~~, ==) before segmentation
	// They'll be restored to each sentence individually after segmentation
	const {
		strippedText,
		spans: decorationSpans,
		strippedToOriginalOffset,
	} = stripDecorations(safeText);

	// Create offset mapping for later heading placement
	const offsetMap = offsetMapperHelper.createRemovalMap(
		headingsToRemovedItems(headings),
	);

	// Scan the stripped text for proper line metadata
	const filteredLines = scanLines(strippedText, fullConfig.languageConfig);

	// Run pipeline stages 2-3 on stripped text
	const sentenceTokens = segmentSentences(
		strippedText,
		fullConfig.languageConfig,
	);
	const annotated = annotateSentences(
		sentenceTokens,
		filteredLines,
		strippedText,
		fullConfig.languageConfig,
	);

	// Filter out blank "sentences" (whitespace-only), horizontal rules, and code blocks
	// These will be reinserted during formatting without block markers
	const horizontalRules: HorizontalRuleInfo[] = [];
	const codeBlocks: CodeBlockInfo[] = [];
	const filtered = annotated.filter((s, i) => {
		const trimmed = s.text.trim();
		if (trimmed.length === 0) {
			return false; // Skip blank
		}
		if (isHorizontalRule(trimmed)) {
			horizontalRules.push({ originalIndex: i, sentence: s });
			return false; // Skip HR from main pipeline
		}
		if (isCodeBlock(trimmed)) {
			codeBlocks.push({ originalIndex: i, sentence: s });
			return false; // Skip code block from main pipeline
		}
		return true;
	});

	// Re-detect paragraph boundaries after filtering
	const withParagraphs = detectParagraphsAfterFilter(filtered, strippedText);

	// Merge orphaned markdown markers with previous sentence
	const withOrphansMerged = mergeOrphanedMarkers(withParagraphs);

	// Restore decorations to each sentence individually
	const withDecorations = restoreDecorations(
		withOrphansMerged,
		decorationSpans,
	);

	// Group sentences into blocks
	const blocks = groupSentencesIntoBlocks(withDecorations, fullConfig);

	// Restore protected content in blocks BEFORE heading insertion
	// Pass strippedToOriginalOffset to map: stripped → protected → filtered
	const blocksWithRestoredContent = restoreBlocksContent(
		blocks,
		protectedItems,
		strippedToOriginalOffset,
	);

	// Create protected-to-filtered offset map for HR placement
	const replacedItems: ReplacedItem[] = protectedItems.map((item) => ({
		original: item.original,
		placeholder: item.placeholder,
		startOffset: item.startOffset,
	}));
	const protectedToFiltered =
		offsetMapperHelper.createReplacementMap(replacedItems);

	// Build format context for later formatting
	const formatContext: FormatContext = {
		codeBlocks,
		headings,
		horizontalRules,
		offsetMap,
		protectedItems,
		protectedToFiltered,
	};

	// Format with markers and reinsert headings/horizontal rules
	const markedText = formatBlocksWithMarkers(
		blocksWithRestoredContent,
		startIndex,
		formatContext,
	);

	return {
		blockCount: blocksWithRestoredContent.length,
		blocks: blocksWithRestoredContent,
		formatContext,
		markedText,
	};
}

/**
 * Create an offset mapping from filtered text positions to original text positions.
 * This accounts for the removed heading content.
 *
 * @deprecated Use offsetMapperHelper.createRemovalMap instead
 */
export function createOffsetMap(
	headings: ExtractedHeading[],
): (filtered: number) => number {
	return offsetMapperHelper.createRemovalMap(
		headingsToRemovedItems(headings),
	);
}
