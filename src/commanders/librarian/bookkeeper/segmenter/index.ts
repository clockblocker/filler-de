import { stripGoBackLink } from "../../../../managers/obsidian/navigation/go-back-link";
import { parseSeparatedSuffix } from "../../codecs/internal/suffix/parse";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type { CodecRules } from "../../codecs/rules";
import {
	DEFAULT_SEGMENTATION_CONFIG,
	type PageSegment,
	type SegmentationConfig,
	type SegmentationResult,
} from "../types";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "./language-config";
import {
	accumulatePages,
	annotateTokens,
	groupTokens,
	preprocessLargeGroups,
	scanLines,
	segmentToTokens,
} from "./stream";

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

	// Strip navigation go-back link before processing
	const cleanContent = stripGoBackLink(content);

	// Check if content is too short to split
	if (cleanContent.length < config.minContentSizeChars) {
		return {
			pages: [
				{
					charCount: cleanContent.length,
					content: cleanContent,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	// Run the pipeline
	const pages = runPipeline(cleanContent, config, langConfig);

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
 * Runs the token-based pipeline with explicit paragraph break markers.
 */
function runPipeline(
	content: string,
	config: SegmentationConfig,
	langConfig: LanguageConfig,
): PageSegment[] {
	// Stage 1: Scan lines and track quote state
	const lines = scanLines(content, langConfig);

	// Stage 2: Segment into tokens (sentences + paragraph breaks)
	const rawTokens = segmentToTokens(content, langConfig);

	// Stage 3: Annotate tokens with context
	const annotatedTokens = annotateTokens(rawTokens, lines, langConfig);

	// Stage 4: Group tokens (paragraph breaks force boundaries)
	const groups = groupTokens(annotatedTokens);

	// Pre-process: split any oversized groups
	const processedGroups = preprocessLargeGroups(groups, config);

	// Stage 5: Accumulate groups into pages
	const pages = accumulatePages(processedGroups, config);

	return pages;
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

export type { LanguageConfig } from "./language-config";
// Re-exports for compatibility
export {
	DEFAULT_LANGUAGE_CONFIG,
	ENGLISH_CONFIG,
	GERMAN_CONFIG,
} from "./language-config";

// Legacy exports (deprecated - kept for compatibility)
export { blocksCharCount, blocksToContent, parseBlocks } from "./parse-blocks";
export {
	canSplitBetweenBlocks,
	isPreferredSplitPoint,
	type SegmentationRule,
} from "./rules";
