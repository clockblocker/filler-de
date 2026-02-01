import { goBackLinkHelper } from "../../../../stateless-helpers/go-back-link";
import { parseSeparatedSuffix } from "../../codecs/internal/suffix/parse";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import type { CodecRules } from "../../codecs/rules";
import {
	DEFAULT_SEGMENTATION_CONFIG,
	type PageSegment,
	type SegmentationConfig,
	type SegmentationResult,
	type SentenceGroup,
} from "../types";
import {
	createOffsetMap,
	type ExtractedHeading,
	extractHeadings,
	filterHeadingsFromText,
	findPrecedingHeading,
} from "./block-marker/split-str-in-blocks";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "./language-config";
import {
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
	const cleanContent = goBackLinkHelper.strip(content);

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
	const offsetMap = createOffsetMap(headings);

	// Scan filtered content for proper line metadata
	const filteredLines = scanLines(filteredContent, langConfig);

	// Stage 2: Segment into tokens (sentences + paragraph breaks)
	const rawTokens = segmentToTokens(filteredContent, langConfig);

	// Stage 3: Annotate tokens with context
	const annotatedTokens = annotateTokens(
		rawTokens,
		filteredLines,
		langConfig,
	);

	// Stage 4: Group tokens (paragraph breaks force boundaries)
	const groups = groupTokens(annotatedTokens);

	// Pre-process: split any oversized groups
	const processedGroups = preprocessLargeGroups(groups, config);

	// Stage 5: Accumulate groups into pages with heading awareness
	const pages = accumulatePagesWithHeadings(
		processedGroups,
		config,
		headings,
		offsetMap,
	);

	return pages;
}

/**
 * Simple pipeline without heading handling (for content without headings).
 */
function runPipelineSimple(
	content: string,
	config: SegmentationConfig,
	langConfig: LanguageConfig,
): PageSegment[] {
	const lines = scanLines(content, langConfig);
	const rawTokens = segmentToTokens(content, langConfig);
	const annotatedTokens = annotateTokens(rawTokens, lines, langConfig);
	const groups = groupTokens(annotatedTokens);
	const processedGroups = preprocessLargeGroups(groups, config);
	return accumulatePagesSimple(processedGroups, config);
}

/**
 * Reconstructs text from sentence groups, preserving paragraph spacing.
 */
function groupsToContent(groups: SentenceGroup[]): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const [first, ...rest] = sentences;
	if (!first) return "";
	let result = first.text;
	for (const s of rest) {
		if (s.startsNewParagraph) {
			result += `\n\n${s.text.trimStart()}`;
		} else {
			result += s.text;
		}
	}
	return result;
}

/**
 * Reconstructs text from sentence groups with headings inserted.
 */
function groupsToContentWithHeadings(
	groups: SentenceGroup[],
	headings: ExtractedHeading[],
	offsetMap: (n: number) => number,
	usedHeadings: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding heading
		const originalOffset = offsetMap(s.sourceOffset);
		const heading = findPrecedingHeading(
			originalOffset,
			headings,
			usedHeadings,
		);

		if (i === 0) {
			if (heading) {
				parts.push(`${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (heading) {
				parts.push(`\n\n${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (heading) {
				// Heading in middle of paragraph - add newline before heading
				parts.push(`\n${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}

/**
 * Checks if we should break the page after adding a group.
 */
function shouldBreakPage(
	currentSize: number,
	nextGroup: SentenceGroup | undefined,
	config: SegmentationConfig,
): boolean {
	if (!nextGroup) return false;
	if (currentSize < config.targetPageSizeChars) return false;

	if (currentSize >= config.targetPageSizeChars) {
		if (!nextGroup.isSplittable) {
			const wouldBe = currentSize + nextGroup.charCount;
			if (wouldBe <= config.maxPageSizeChars * 1.5) {
				return false;
			}
		}
		return true;
	}

	if (currentSize >= config.maxPageSizeChars) {
		return true;
	}

	return false;
}

/**
 * Simple page accumulator without heading handling.
 */
function accumulatePagesSimple(
	groups: SentenceGroup[],
	config: SegmentationConfig,
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContent(currentPageGroups);
			pages.push({
				charCount: content.length,
				content,
				pageIndex: pages.length,
			});
			currentPageGroups = [];
			currentPageSize = 0;
		}
	}

	if (currentPageGroups.length > 0) {
		const content = groupsToContent(currentPageGroups);
		pages.push({
			charCount: content.length,
			content,
			pageIndex: pages.length,
		});
	}

	return pages;
}

/**
 * Page accumulator with heading reinsertion.
 */
function accumulatePagesWithHeadings(
	groups: SentenceGroup[],
	config: SegmentationConfig,
	headings: ExtractedHeading[],
	offsetMap: (n: number) => number,
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;
	const usedHeadings = new Set<number>();

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContentWithHeadings(
				currentPageGroups,
				headings,
				offsetMap,
				usedHeadings,
			);
			pages.push({
				charCount: content.length,
				content,
				pageIndex: pages.length,
			});
			currentPageGroups = [];
			currentPageSize = 0;
		}
	}

	if (currentPageGroups.length > 0) {
		const content = groupsToContentWithHeadings(
			currentPageGroups,
			headings,
			offsetMap,
			usedHeadings,
		);
		pages.push({
			charCount: content.length,
			content,
			pageIndex: pages.length,
		});
	}

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
