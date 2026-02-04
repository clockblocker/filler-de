import {
	offsetMapperHelper,
	type RemovedItem,
	type ReplacedItem,
} from "../../../../stateless-helpers/offset-mapper";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type {
	PageSegment,
	SegmentationConfig,
	SegmentationResult,
	SentenceGroup,
} from "../types";
import { DEFAULT_SEGMENTATION_CONFIG } from "../types";
import {
	extractHeadings,
	filterHeadingsFromText,
} from "./block-marker/heading-extraction";
import {
	formatBlocksWithMarkers,
	splitStrInBlocksWithIntermediate,
	stripBlockMarkers,
} from "./block-marker/split-str-in-blocks";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "./language-config";
import { groupBlocksIntoPages } from "./page-formatter/block-page-accumulator";
import {
	accumulatePagesWithHeadingsAndHRs,
	accumulatePagesWithHRs,
	filterEmptyPages,
} from "./page-formatter/page-accumulator";
import { annotateTokens } from "./stream/context-annotator";
import {
	type DecorationSpan,
	healUnclosedDecorations,
	restoreDecorations,
	stripDecorations,
} from "./stream/decoration-stripper";
import { scanLines } from "./stream/line-scanner";
import {
	type ProtectedContent,
	protectMarkdownSyntax,
	restoreProtectedContent,
} from "./stream/markdown-protector";
import { preprocessLargeGroups } from "./stream/page-accumulator";
import { groupTokens } from "./stream/region-grouper";
import { segmentToTokens } from "./stream/sentence-segmenter";
import {
	filterHRPlaceholders,
	mergeOrphanedMarkersInTokens,
} from "./stream/token-filter";

/**
 * Segments markdown content into pages using the sentence-stream pipeline.
 *
 * Pipeline stages:
 * 1. Line Scanner: Scans lines and tracks quote state
 * 2. Sentence Segmenter: Splits into sentences using Intl.Segmenter
 * 3. Context Annotator: Adds quote depth, region markers
 * 4. Region Grouper: Groups keep-together content (poems, quotes)
 * 5. Page Accumulator: Builds pages respecting size limits
 *
 * @param content - The markdown content to segment
 * @param sourceBasenameInfo - Parsed basename info (coreName + suffixParts)
 * @param config - Segmentation configuration
 * @param langConfig - Language-specific configuration
 * @returns Segmentation result with pages and metadata
 */
export function segmentContent(
	content: string,
	sourceBasenameInfo: SeparatedSuffixedBasename,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
	langConfig: LanguageConfig = DEFAULT_LANGUAGE_CONFIG,
): SegmentationResult {
	const { coreName, suffixParts } = sourceBasenameInfo;

	// Pre-process: Heal unclosed decorations (Obsidian treats *text same as *text*)
	const healedContent = healUnclosedDecorations(content);

	// Check if content is too short to split
	// NOTE: Caller is responsible for stripping go-back links before calling
	if (healedContent.length < config.minContentSizeChars) {
		return {
			pages: [
				{
					charCount: healedContent.length,
					content: healedContent,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	// Run the pipeline
	const pages = runPipeline(healedContent, config, langConfig);

	// Filter out empty pages
	const nonEmpty = filterEmptyPages(pages);

	return {
		pages: nonEmpty,
		sourceCoreName: coreName,
		sourceSuffix: suffixParts,
		tooShortToSplit: false,
	};
}

/**
 * Unified segmentation that produces pages WITH block markers.
 *
 * This is the optimized pipeline that:
 * 1. Runs splitStrInBlocksWithIntermediate once to get blocks
 * 2. Groups blocks into pages
 * 3. Formats each page with block markers
 *
 * Unlike segmentContent + splitStrInBlocks per page, this runs O(N) instead of O(N × pages).
 *
 * @param content - The markdown content to segment
 * @param sourceBasenameInfo - Parsed basename info (coreName + suffixParts)
 * @param config - Segmentation configuration
 * @returns Segmentation result with pages containing block markers
 */
export function segmentContentWithBlockMarkers(
	content: string,
	sourceBasenameInfo: SeparatedSuffixedBasename,
	config: SegmentationConfig = DEFAULT_SEGMENTATION_CONFIG,
): SegmentationResult {
	const { coreName, suffixParts } = sourceBasenameInfo;

	// Strip existing block markers for idempotency
	const withoutMarkers = stripBlockMarkers(content);

	// Check if content is too short to split
	if (withoutMarkers.length < config.minContentSizeChars) {
		// For too-short content, still apply block markers
		const { markedText, blockCount } = splitStrInBlocksWithIntermediate(
			withoutMarkers,
			0,
		);
		return {
			pages: [
				{
					charCount: markedText.length,
					content: markedText,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	// Run unified pipeline: blocks → pages → marked pages
	const { blocks, formatContext } = splitStrInBlocksWithIntermediate(
		withoutMarkers,
		0,
	);

	// Group blocks into pages
	const pageGroups = groupBlocksIntoPages(blocks, config);

	// Format each page group with block markers
	// Each page starts block IDs at 0
	const pages: PageSegment[] = pageGroups.map((group, pageIndex) => {
		const markedText = formatBlocksWithMarkers(
			group.blocks,
			0, // Each page starts at block ^0
			formatContext,
		);
		return {
			charCount: markedText.length,
			content: markedText,
			pageIndex,
		};
	});

	// Filter out empty pages and re-index
	const nonEmpty = filterEmptyPages(pages);

	return {
		pages: nonEmpty,
		sourceCoreName: coreName,
		sourceSuffix: suffixParts,
		tooShortToSplit: false,
	};
}

/**
 * Runs the token-based pipeline with explicit paragraph break markers.
 * Extracts headings before segmentation and reinserts them into pages.
 */
function runPipeline(
	content: string,
	config: SegmentationConfig,
	langConfig: LanguageConfig,
): PageSegment[] {
	// Stage 1: Scan lines and track quote state, extract headings
	const lines = scanLines(content, langConfig);
	const headings = extractHeadings(lines);

	// If no headings, run simpler pipeline
	if (headings.length === 0) {
		return runPipelineSimple(content, config, langConfig);
	}

	// Filter heading content before sentence segmentation
	const filteredContent = filterHeadingsFromText(content, headings);
	const removedItems: RemovedItem[] = headings.map((h) => ({
		endOffset: h.endOffset,
		startOffset: h.startOffset,
	}));
	const offsetMap = offsetMapperHelper.createRemovalMap(removedItems);

	// Protect markdown syntax (URLs, wikilinks, etc.) before segmentation
	const { safeText, protectedItems } = protectMarkdownSyntax(filteredContent);

	// Strip decorations (*, **, ~~, ==) before segmentation
	// They'll be restored to each sentence individually after grouping
	const { strippedText, spans: decorationSpans } = stripDecorations(safeText);

	// Scan stripped content for proper line metadata
	const filteredLines = scanLines(strippedText, langConfig);

	// Stage 2: Segment into tokens (sentences + paragraph breaks)
	const rawTokens = segmentToTokens(strippedText, langConfig);

	// Stage 3: Annotate tokens with context
	const annotatedTokens = annotateTokens(
		rawTokens,
		filteredLines,
		langConfig,
	);

	// Filter out HR placeholders from tokens, tracking them for later reinsertion
	const { filteredTokens, hrInfos } = filterHRPlaceholders(annotatedTokens);

	// Merge orphaned decoration markers (lone *, **, etc.) with adjacent sentences
	const tokensWithMergedOrphans =
		mergeOrphanedMarkersInTokens(filteredTokens);

	// Stage 4: Group tokens (paragraph breaks force boundaries)
	const groups = groupTokens(tokensWithMergedOrphans);

	// Pre-process: split any oversized groups
	const processedGroups = preprocessLargeGroups(groups, config);

	// Restore decorations in groups
	const groupsWithDecorations = restoreDecorationsInGroups(
		processedGroups,
		decorationSpans,
	);

	// Restore protected content in groups BEFORE heading insertion.
	// This is critical: the offset map only accounts for heading removal.
	// If we insert headings while text contains placeholders, offsets are wrong
	// because placeholder lengths differ from original content lengths.
	const groupsWithRestoredContent = restoreGroupsContent(
		groupsWithDecorations,
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

	// Stage 5: Accumulate groups into pages with heading and HR awareness
	// Content is already restored, so no need for restoreProtectedInPages after
	return accumulatePagesWithHeadingsAndHRs(
		groupsWithRestoredContent,
		config,
		headings,
		hrInfos,
		offsetMap,
		protectedToFiltered,
		protectedItems,
	);
}

/**
 * Simple pipeline without heading handling (for content without headings).
 */
function runPipelineSimple(
	content: string,
	config: SegmentationConfig,
	langConfig: LanguageConfig,
): PageSegment[] {
	// Protect markdown syntax (URLs, wikilinks, etc.) before segmentation
	const { safeText, protectedItems } = protectMarkdownSyntax(content);

	// Strip decorations (*, **, ~~, ==) before segmentation
	// They'll be restored to each sentence individually after grouping
	const { strippedText, spans: decorationSpans } = stripDecorations(safeText);

	const lines = scanLines(strippedText, langConfig);
	const rawTokens = segmentToTokens(strippedText, langConfig);
	const annotatedTokens = annotateTokens(rawTokens, lines, langConfig);

	// Filter out HR placeholders from tokens, tracking them for later reinsertion
	const { filteredTokens, hrInfos } = filterHRPlaceholders(annotatedTokens);

	// Merge orphaned decoration markers (lone *, **, etc.) with adjacent sentences
	const tokensWithMergedOrphans =
		mergeOrphanedMarkersInTokens(filteredTokens);

	const groups = groupTokens(tokensWithMergedOrphans);
	const processedGroups = preprocessLargeGroups(groups, config);

	// Restore decorations in groups
	const groupsWithDecorations = restoreDecorationsInGroups(
		processedGroups,
		decorationSpans,
	);

	// Restore protected content in groups
	const groupsWithRestoredContent = restoreGroupsContent(
		groupsWithDecorations,
		protectedItems,
	);

	// Create identity offset map (no headings removed)
	const identityOffsetMap = (offset: number) => offset;

	// Create protected-to-filtered offset map for HR placement
	const replacedItems: ReplacedItem[] = protectedItems.map((item) => ({
		original: item.original,
		placeholder: item.placeholder,
		startOffset: item.startOffset,
	}));
	const protectedToFiltered =
		offsetMapperHelper.createReplacementMap(replacedItems);

	// Accumulate pages with HR handling (no headings in this pipeline)
	return accumulatePagesWithHRs(
		groupsWithRestoredContent,
		config,
		hrInfos,
		identityOffsetMap,
		protectedToFiltered,
		protectedItems,
	);
}

/**
 * Restores decorations to sentences within groups.
 */
function restoreDecorationsInGroups(
	groups: SentenceGroup[],
	decorationSpans: DecorationSpan[],
): SentenceGroup[] {
	if (decorationSpans.length === 0) return groups;

	return groups.map((group) => ({
		...group,
		sentences: restoreDecorations(
			group.sentences,
			decorationSpans,
		) as typeof group.sentences,
	}));
}

/**
 * Creates a mapping function from protected-text offsets to filtered-text offsets.
 */
function createProtectedToFilteredMap(
	protectedItems: ProtectedContent[],
): (protectedOffset: number) => number {
	const replacedItems: ReplacedItem[] = protectedItems.map((item) => ({
		original: item.original,
		placeholder: item.placeholder,
		startOffset: item.startOffset,
	}));
	return offsetMapperHelper.createReplacementMap(replacedItems);
}

/**
 * Restore protected markdown content within sentence texts in groups.
 * Also adjusts sourceOffset to map from protected-space to filtered-space,
 * so that the heading offset map works correctly.
 */
function restoreGroupsContent(
	groups: SentenceGroup[],
	protectedItems: ProtectedContent[],
): SentenceGroup[] {
	if (protectedItems.length === 0) return groups;

	const protectedToFiltered = createProtectedToFilteredMap(protectedItems);

	return groups.map((group) => ({
		...group,
		sentences: group.sentences.map((s) => {
			const restoredText = restoreProtectedContent(
				s.text,
				protectedItems,
			);
			return {
				...s,
				charCount: restoredText.length,
				sourceOffset: protectedToFiltered(s.sourceOffset),
				text: restoredText,
			};
		}) as typeof group.sentences,
	}));
}

export type { LanguageConfig } from "./language-config";
