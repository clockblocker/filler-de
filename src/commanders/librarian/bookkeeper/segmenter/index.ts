import {
	offsetMapperHelper,
	type RemovedItem,
	type ReplacedItem,
} from "../../../../stateless-helpers/offset-mapper";
import type { SeparatedSuffixedBasename } from "../../codecs/internal/suffix/types";
import {
	type AnnotatedSentence,
	type ContentToken,
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
	isHorizontalRule,
	isOrphanedMarker,
} from "./block-marker/text-patterns";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "./language-config";
import { annotateTokens } from "./stream/context-annotator";
import {
	type DecorationSpan,
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
 * Horizontal rule info for tracking HRs extracted during segmentation.
 */
type HRInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};

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
	const { filteredTokens, hrInfos } = filterHRPlaceholders(
		annotatedTokens,
		protectedItems,
	);

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
	const { filteredTokens, hrInfos } = filterHRPlaceholders(
		annotatedTokens,
		protectedItems,
	);

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
 * Filters out HR placeholder tokens from annotated tokens.
 * Returns filtered tokens and tracked HR info for later reinsertion.
 */
function filterHRPlaceholders(
	tokens: ContentToken[],
	_protectedItems: ProtectedContent[],
): { filteredTokens: ContentToken[]; hrInfos: HRInfo[] } {
	const hrInfos: HRInfo[] = [];
	let sentenceIndex = 0;

	const filteredTokens = tokens.filter((token) => {
		if (token.kind !== "sentence") {
			return true; // Keep paragraph breaks
		}

		const trimmed = token.sentence.text.trim();

		// Check if this is an HR placeholder
		if (isHorizontalRule(trimmed)) {
			hrInfos.push({
				originalIndex: sentenceIndex,
				sentence: token.sentence,
			});
			sentenceIndex++;
			return false; // Filter out HR
		}

		sentenceIndex++;
		return true;
	});

	return { filteredTokens, hrInfos };
}

/**
 * Merges orphaned decoration markers (lone *, **, etc.) with the previous sentence.
 * Works on ContentToken array to preserve paragraph breaks.
 */
function mergeOrphanedMarkersInTokens(tokens: ContentToken[]): ContentToken[] {
	const result: ContentToken[] = [];

	for (const token of tokens) {
		if (token.kind === "paragraphBreak") {
			result.push(token);
			continue;
		}

		// Check if this sentence is an orphaned marker
		if (isOrphanedMarker(token.sentence.text.trim())) {
			// Try to merge with previous sentence (skip paragraph breaks when looking)
			for (let i = result.length - 1; i >= 0; i--) {
				const prev = result[i];
				if (prev?.kind === "sentence") {
					// Merge orphan into previous sentence
					result[i] = {
						kind: "sentence",
						sentence: {
							...prev.sentence,
							charCount:
								prev.sentence.charCount +
								token.sentence.charCount,
							text: prev.sentence.text + token.sentence.text,
						},
					};
					break;
				}
				// If we hit a paragraph break, stop looking (don't merge across paragraphs)
				if (prev?.kind === "paragraphBreak") {
					break;
				}
			}
			// Drop orphan at start or after paragraph break (edge case)
			continue;
		}

		result.push(token);
	}

	return result;
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
 * Restores protected markdown content in all pages.
 */
function _restoreProtectedInPages(
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
 * Reconstructs text from sentence groups with headings and HRs inserted.
 */
function groupsToContentWithHeadingsAndHRs(
	groups: SentenceGroup[],
	headings: ExtractedHeading[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding elements
		const originalOffset = offsetMap(s.sourceOffset);

		// Find preceding heading
		const heading = findPrecedingHeading(
			originalOffset,
			headings,
			usedHeadings,
		);

		// Find preceding HRs
		const precedingHRs = findPrecedingHRs(
			originalOffset,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			usedHRs,
			protectedItems,
		);

		// Build element prefix (heading and/or HRs)
		const elementParts: string[] = [];
		for (const hr of precedingHRs) {
			elementParts.push(hr.text);
		}
		if (heading) {
			elementParts.push(heading.text);
		}
		const elementsPrefix =
			elementParts.length > 0 ? elementParts.join("\n") : null;

		if (i === 0) {
			if (elementsPrefix) {
				parts.push(`${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (elementsPrefix) {
				parts.push(`\n\n${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (elementsPrefix) {
				// Element in middle of paragraph - add newline before
				parts.push(`\n${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}

/**
 * Reconstructs text from sentence groups with only HRs inserted (no headings).
 */
function groupsToContentWithHRs(
	groups: SentenceGroup[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
	usedHRs: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding HRs
		const originalOffset = offsetMap(s.sourceOffset);

		// Find preceding HRs
		const precedingHRs = findPrecedingHRs(
			originalOffset,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			usedHRs,
			protectedItems,
		);

		const hrPrefix =
			precedingHRs.length > 0
				? precedingHRs.map((hr) => hr.text).join("\n")
				: null;

		if (i === 0) {
			if (hrPrefix) {
				parts.push(`${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (hrPrefix) {
				parts.push(`\n\n${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (hrPrefix) {
				parts.push(`\n${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}

/**
 * Find HRs that precede a given sentence's original offset.
 */
function findPrecedingHRs(
	sentenceOriginalOffset: number,
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	usedHRs: Set<number>,
	protectedItems: ProtectedContent[],
): { text: string; originalOffset: number }[] {
	const result: { text: string; originalOffset: number }[] = [];

	for (let i = 0; i < hrInfos.length; i++) {
		if (usedHRs.has(i)) continue;
		const hr = hrInfos[i];
		if (!hr) continue;

		// Convert HR offset: protected -> filtered -> original
		const hrFilteredOffset = protectedToFiltered(hr.sentence.sourceOffset);
		const hrOriginalOffset = offsetMap(hrFilteredOffset);

		if (hrOriginalOffset <= sentenceOriginalOffset) {
			// Restore the HR text from placeholder
			const hrText = restoreProtectedContent(
				hr.sentence.text.trim(),
				protectedItems,
			);
			result.push({
				originalOffset: hrOriginalOffset,
				text: hrText,
			});
			usedHRs.add(i);
		}
	}

	// Sort by original offset to maintain document order
	result.sort((a, b) => a.originalOffset - b.originalOffset);
	return result;
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
function _accumulatePagesSimple(
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
function _accumulatePagesWithHeadings(
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
 * Page accumulator with heading and HR reinsertion.
 */
function accumulatePagesWithHeadingsAndHRs(
	groups: SentenceGroup[],
	config: SegmentationConfig,
	headings: ExtractedHeading[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;
	const usedHeadings = new Set<number>();
	const usedHRs = new Set<number>();

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContentWithHeadingsAndHRs(
				currentPageGroups,
				headings,
				hrInfos,
				offsetMap,
				protectedToFiltered,
				protectedItems,
				usedHeadings,
				usedHRs,
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
		const content = groupsToContentWithHeadingsAndHRs(
			currentPageGroups,
			headings,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			protectedItems,
			usedHeadings,
			usedHRs,
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
 * Page accumulator with HR reinsertion (no headings).
 */
function accumulatePagesWithHRs(
	groups: SentenceGroup[],
	config: SegmentationConfig,
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;
	const usedHRs = new Set<number>();

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContentWithHRs(
				currentPageGroups,
				hrInfos,
				offsetMap,
				protectedToFiltered,
				protectedItems,
				usedHRs,
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
		const content = groupsToContentWithHRs(
			currentPageGroups,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			protectedItems,
			usedHRs,
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
