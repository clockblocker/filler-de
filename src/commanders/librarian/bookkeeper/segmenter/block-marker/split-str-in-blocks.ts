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
import type { HorizontalRuleInfo } from "./heading-insertion";
import { isHorizontalRule } from "./text-patterns";
import {
	type BlockMarkerConfig,
	type BlockSplitResult,
	DEFAULT_BLOCK_MARKER_CONFIG,
} from "./types";

// Re-export types that are part of public API
export type { ExtractedHeading } from "./heading-extraction";
export { extractHeadings, filterHeadingsFromText } from "./heading-extraction";
export { findPrecedingHeading } from "./heading-insertion";
export type { BlockMarkerConfig, BlockSplitResult } from "./types";
export { DEFAULT_BLOCK_MARKER_CONFIG } from "./types";

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
	const fullConfig: BlockMarkerConfig = {
		...DEFAULT_BLOCK_MARKER_CONFIG,
		...config,
	};

	// Skip empty or whitespace-only text
	if (!text.trim()) {
		return { blockCount: 0, markedText: "" };
	}

	// Stage 1: Scan lines to detect headings and other line metadata
	const lines = scanLines(text, fullConfig.languageConfig);

	// Extract headings for later reinsertion
	const headings = extractHeadings(lines);

	// Filter out heading content before sentence segmentation
	const filteredText = filterHeadingsFromText(text, headings);

	// Protect markdown syntax (URLs, wikilinks, etc.) before segmentation
	const { safeText, protectedItems } = protectMarkdownSyntax(filteredText);

	// Strip decorations (*, **, ~~, ==) before segmentation
	// They'll be restored to each sentence individually after segmentation
	const { strippedText, spans: decorationSpans } = stripDecorations(safeText);

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

	// Filter out blank "sentences" (whitespace-only) and horizontal rules
	// Horizontal rules will be reinserted during formatting
	const horizontalRules: HorizontalRuleInfo[] = [];
	const filtered = annotated.filter((s, i) => {
		const trimmed = s.text.trim();
		if (trimmed.length === 0) {
			return false; // Skip blank
		}
		if (isHorizontalRule(trimmed)) {
			horizontalRules.push({ originalIndex: i, sentence: s });
			return false; // Skip HR from main pipeline
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
	const blocksWithRestoredContent = restoreBlocksContent(
		blocks,
		protectedItems,
	);

	// Create protected-to-filtered offset map for HR placement
	const replacedItems: ReplacedItem[] = protectedItems.map((item) => ({
		original: item.original,
		placeholder: item.placeholder,
		startOffset: item.startOffset,
	}));
	const protectedToFiltered =
		offsetMapperHelper.createReplacementMap(replacedItems);

	// Format with markers and reinsert headings/horizontal rules
	const formatContext: FormatContext = {
		headings,
		horizontalRules,
		offsetMap,
		protectedItems,
		protectedToFiltered,
	};
	const markedText = formatBlocksWithMarkers(
		blocksWithRestoredContent,
		startIndex,
		formatContext,
	);

	return {
		blockCount: blocksWithRestoredContent.length,
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
