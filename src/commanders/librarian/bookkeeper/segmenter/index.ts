import {
	offsetMapperHelper,
	type ReplacedItem,
	type RemovedItem,
} from "../../../../stateless-helpers/offset-mapper";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import {
	DEFAULT_SEGMENTATION_CONFIG,
	type PageSegment,
	type SegmentationConfig,
	type SegmentationResult,
	type SentenceGroup,
} from "../types";
import {
	type ExtractedHeading,
	extractHeadings,
	filterHeadingsFromText,
} from "./block-marker/heading-extraction";
import { findPrecedingHeading } from "./block-marker/heading-insertion";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "./language-config";
import { annotateTokens } from "./stream/context-annotator";
import { scanLines } from "./stream/line-scanner";
import {
	type ProtectedContent,
	protectMarkdownSyntax,
	restoreProtectedContent,
} from "./stream/markdown-protector";
import { preprocessLargeGroups } from "./stream/page-accumulator";
import { groupTokens } from "./stream/region-grouper";
import { segmentToTokens } from "./stream/sentence-segmenter";

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

	// Check if content is too short to split
	// NOTE: Caller is responsible for stripping go-back links before calling
	if (content.length < config.minContentSizeChars) {
		return {
			pages: [
				{
					charCount: content.length,
					content: content,
					pageIndex: 0,
				},
			],
			sourceCoreName: coreName,
			sourceSuffix: suffixParts,
			tooShortToSplit: true,
		};
	}

	// Run the pipeline
	const pages = runPipeline(content, config, langConfig);

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
	const removedItems: RemovedItem[] = headings.map((h) => ({
		endOffset: h.endOffset,
		startOffset: h.startOffset,
	}));
	const offsetMap = offsetMapperHelper.createRemovalMap(removedItems);

	// Protect markdown syntax (URLs, wikilinks, etc.) before segmentation
	const { safeText, protectedItems } = protectMarkdownSyntax(filteredContent);

	// Scan protected content for proper line metadata
	const filteredLines = scanLines(safeText, langConfig);

	// Stage 2: Segment into tokens (sentences + paragraph breaks)
	const rawTokens = segmentToTokens(safeText, langConfig);

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

	// Restore protected content in groups BEFORE heading insertion.
	// This is critical: the offset map only accounts for heading removal.
	// If we insert headings while text contains placeholders, offsets are wrong
	// because placeholder lengths differ from original content lengths.
	const groupsWithRestoredContent = restoreGroupsContent(
		processedGroups,
		protectedItems,
	);

	// Stage 5: Accumulate groups into pages with heading awareness
	// Content is already restored, so no need for restoreProtectedInPages after
	return accumulatePagesWithHeadings(
		groupsWithRestoredContent,
		config,
		headings,
		offsetMap,
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

	const lines = scanLines(safeText, langConfig);
	const rawTokens = segmentToTokens(safeText, langConfig);
	const annotatedTokens = annotateTokens(rawTokens, lines, langConfig);
	const groups = groupTokens(annotatedTokens);
	const processedGroups = preprocessLargeGroups(groups, config);
	const pages = accumulatePagesSimple(processedGroups, config);

	// Restore protected content in final pages
	return restoreProtectedInPages(pages, protectedItems);
}

/**
 * Restores protected markdown content in all pages.
 */
function restoreProtectedInPages(
	pages: PageSegment[],
	protectedItems: ProtectedContent[],
): PageSegment[] {
	if (protectedItems.length === 0) return pages;

	return pages.map((page) => {
		const restoredContent = restoreProtectedContent(
			page.content,
			protectedItems,
		);
		return {
			...page,
			charCount: restoredContent.length,
			content: restoredContent,
		};
	});
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

export type { LanguageConfig } from "./language-config";
