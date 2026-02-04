import type { AnnotatedSentence, ScannedLine } from "../../types";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "../language-config";
import { annotateSentences } from "../stream/context-annotator";
import { scanLines } from "../stream/line-scanner";
import {
	type ProtectedContent,
	protectMarkdownSyntax,
	restoreProtectedContent,
} from "../stream/markdown-protector";
import { segmentSentences } from "../stream/sentence-segmenter";

/**
 * Strip existing block markers (` ^N`) to ensure idempotent re-marking.
 * Matches markers anywhere, not just at end of line, to handle malformed content.
 */
export function stripBlockMarkers(text: string): string {
	return text.replace(/ \^\d+/g, "");
}

/**
 * A heading extracted from content with its position info.
 */
export type ExtractedHeading = {
	/** The heading text (e.g., "###### **ANNA:**") */
	text: string;
	/** Character offset in original content where heading starts */
	startOffset: number;
	/** Character offset where heading ends (including newline) */
	endOffset: number;
	/** Line number (0-indexed) */
	lineNumber: number;
};

/**
 * Configuration for block marking.
 */
export type BlockMarkerConfig = {
	/** Max words to consider a sentence "short" (default 4) */
	shortSentenceWords: number;
	/** Max words for merged block (default 30) */
	maxMergedWords: number;
	/** Language config for segmentation */
	languageConfig: LanguageConfig;
};

export const DEFAULT_BLOCK_MARKER_CONFIG: BlockMarkerConfig = {
	languageConfig: DEFAULT_LANGUAGE_CONFIG,
	maxMergedWords: 30,
	shortSentenceWords: 4,
};

/**
 * Result of block splitting.
 */
export type BlockSplitResult = {
	/** Text with block markers appended */
	markedText: string;
	/** Number of blocks created */
	blockCount: number;
};

/**
 * Internal block representation during grouping.
 */
type Block = {
	sentences: AnnotatedSentence[];
	wordCount: number;
	/** True if this block is a short speech intro waiting for next sentence */
	pendingSpeechIntro: boolean;
};

/**
 * Extract headings from scanned lines.
 * Returns headings with their original character offsets.
 */
export function extractHeadings(lines: ScannedLine[]): ExtractedHeading[] {
	const headings: ExtractedHeading[] = [];
	let currentOffset = 0;

	for (const line of lines) {
		const lineLength = line.text.length;
		const endOffset = currentOffset + lineLength;

		if (line.isHeading) {
			headings.push({
				endOffset: endOffset + 1, // +1 for newline
				lineNumber: line.lineNumber,
				startOffset: currentOffset,
				text: line.text,
			});
		}

		// Move to next line (+1 for newline, except last line)
		currentOffset = endOffset + 1;
	}

	return headings;
}

/**
 * Remove heading lines from text, replacing them with blank lines to preserve structure.
 * This ensures paragraph boundary detection still works correctly.
 */
export function filterHeadingsFromText(
	originalText: string,
	headings: ExtractedHeading[],
): string {
	if (headings.length === 0) return originalText;

	let result = originalText;
	// Process in reverse order to maintain offset validity
	const sortedHeadings = [...headings].sort(
		(a, b) => b.startOffset - a.startOffset,
	);

	for (const heading of sortedHeadings) {
		// Replace heading with empty line (keep the newline)
		const before = result.slice(0, heading.startOffset);
		const after = result.slice(heading.endOffset);
		result = before + after;
	}

	return result;
}

/**
 * Find which heading precedes a given sentence based on character offset.
 * Returns the heading that immediately precedes (and is closest to) the sentence.
 */
export function findPrecedingHeading(
	sentenceOriginalOffset: number,
	headings: ExtractedHeading[],
	usedHeadings: Set<number>,
): ExtractedHeading | null {
	// Find headings that come before this sentence
	let bestHeading: ExtractedHeading | null = null;

	for (let i = 0; i < headings.length; i++) {
		const heading = headings[i];
		if (!heading) continue;
		// Skip already-used headings
		if (usedHeadings.has(i)) {
			continue;
		}

		// Heading must end before or at sentence start
		if (heading.endOffset <= sentenceOriginalOffset) {
			// Take the closest (latest) heading before this sentence
			if (!bestHeading || heading.endOffset > bestHeading.endOffset) {
				bestHeading = heading;
			}
		}
	}

	// Mark as used
	if (bestHeading) {
		const idx = headings.indexOf(bestHeading);
		if (idx >= 0) usedHeadings.add(idx);
	}

	return bestHeading;
}

/**
 * Create an offset mapping from filtered text positions to original text positions.
 * This accounts for the removed heading content.
 */
export function createOffsetMap(
	headings: ExtractedHeading[],
): (filtered: number) => number {
	if (headings.length === 0) {
		return (offset) => offset;
	}

	// Sort by original start offset
	const sorted = [...headings].sort((a, b) => a.startOffset - b.startOffset);

	// Calculate cumulative removed length at each heading
	type Removal = {
		originalStart: number;
		removedLength: number;
		cumulative: number;
	};
	const removals: Removal[] = [];
	let cumulative = 0;

	for (const h of sorted) {
		const len = h.endOffset - h.startOffset;
		removals.push({
			cumulative,
			originalStart: h.startOffset,
			removedLength: len,
		});
		cumulative += len;
	}

	return (filteredOffset: number) => {
		// Find how much has been removed before this filtered offset
		let totalRemoved = 0;
		for (const r of removals) {
			// If the filtered offset (+ what we've already removed) is past this removal point
			if (filteredOffset + totalRemoved >= r.originalStart) {
				totalRemoved = r.cumulative + r.removedLength;
			} else {
				break;
			}
		}
		return filteredOffset + totalRemoved;
	};
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
	const trimmed = text.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}

/**
 * Lone asterisks/underscores from italics/bold spanning sentences.
 * Pattern: `*`, `**`, `_`, `__`, `***`, `___`
 */
const ORPHAN_MARKER_PATTERN = /^\s*[*_]{1,3}\s*$/;

/**
 * Horizontal rules: 3+ of `-`, `*`, or `_` on their own line.
 */
const HORIZONTAL_RULE_PATTERN = /^\s*(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/;

/**
 * Placeholder for protected horizontal rules (from markdown-protector).
 * Pattern: ␜HR<n>␜ where ␜ is \uFFFC (Object Replacement Character)
 */
const HR_PLACEHOLDER_PATTERN = /^\s*\uFFFCHR\d+\uFFFC\s*$/;

function isOrphanedMarker(text: string): boolean {
	return ORPHAN_MARKER_PATTERN.test(text.trim());
}

function isHorizontalRule(text: string): boolean {
	const trimmed = text.trim();
	// Check both real HR and protected HR placeholder
	return (
		(trimmed.length >= 3 && HORIZONTAL_RULE_PATTERN.test(trimmed)) ||
		HR_PLACEHOLDER_PATTERN.test(trimmed)
	);
}

/**
 * Check if sentence is a short speech intro (ends with ":" and ≤4 words).
 */
function isShortSpeechIntro(
	sentence: AnnotatedSentence,
	threshold: number,
): boolean {
	const text = sentence.text.trim();
	return text.endsWith(":") && countWords(text) <= threshold;
}

/**
 * Re-detect paragraph boundaries after filtering out blank sentences.
 * Checks for blank lines (double newlines) between consecutive sentences.
 */
function detectParagraphsAfterFilter(
	sentences: AnnotatedSentence[],
	originalText: string,
): AnnotatedSentence[] {
	if (sentences.length === 0) return [];

	return sentences.map((sentence, i) => {
		if (i === 0) {
			// First sentence always starts a new paragraph
			return { ...sentence, startsNewParagraph: true };
		}

		const prevSentence = sentences[i - 1];
		if (!prevSentence) return sentence;

		// Check for blank line between end of prev sentence content and start of this sentence.
		// We need to look at the full range including trailing whitespace from prev sentence.
		const rangeStart = prevSentence.sourceOffset;
		const rangeEnd = sentence.sourceOffset;
		const range = originalText.slice(rangeStart, rangeEnd);

		// A blank line is two consecutive newlines (with optional whitespace between)
		const hasBlankLine = /\n\s*\n/.test(range);

		return { ...sentence, startsNewParagraph: hasBlankLine };
	});
}

/**
 * Create a new block with one sentence.
 */
function newBlock(
	sentence: AnnotatedSentence,
	pendingSpeechIntro = false,
): Block {
	return {
		pendingSpeechIntro,
		sentences: [sentence],
		wordCount: countWords(sentence.text),
	};
}

/**
 * Append sentence to block.
 */
function appendToBlock(block: Block, sentence: AnnotatedSentence): void {
	block.sentences.push(sentence);
	block.wordCount += countWords(sentence.text);
}

/**
 * Merge orphaned markdown markers (lone `*`, `**`, etc.) with the previous sentence.
 * These are artifacts from italics/bold spanning multiple sentences.
 */
function mergeOrphanedMarkers(
	sentences: AnnotatedSentence[],
): AnnotatedSentence[] {
	const result: AnnotatedSentence[] = [];
	for (const sentence of sentences) {
		if (isOrphanedMarker(sentence.text.trim())) {
			if (result.length > 0) {
				const prev = result[result.length - 1]!;
				result[result.length - 1] = {
					...prev,
					charCount: prev.charCount + sentence.charCount,
					text: prev.text + sentence.text,
				};
			}
			// Drop orphan at start (edge case)
		} else {
			result.push(sentence);
		}
	}
	return result;
}

/**
 * Group annotated sentences into blocks according to rules:
 * 1. Never merge across paragraph boundaries
 * 2. Direct speech (quoteDepth > 0) stays together
 * 3. Short speech intro (≤4 words + ":") merges with following sentence
 * 4. Short sentences (≤4 words) try to merge with next, else with previous
 * 5. Merged blocks cannot exceed maxMergedWords
 */
function groupSentencesIntoBlocks(
	sentences: AnnotatedSentence[],
	config: BlockMarkerConfig,
): Block[] {
	if (sentences.length === 0) return [];

	const blocks: Block[] = [];
	let pendingShort: Block | null = null; // Short sentence waiting to merge with next
	let current: Block | null = null;

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		const wordCount = countWords(sentence.text);
		const isInQuote = sentence.quoteDepth > 0;
		const startsNewPara = sentence.startsNewParagraph;
		const isShort = wordCount <= config.shortSentenceWords;

		// Rule 1: New paragraph - finalize any pending blocks
		if (startsNewPara) {
			if (pendingShort) {
				// Can't merge forward (new paragraph), try backward or keep alone
				if (
					current &&
					current.wordCount + pendingShort.wordCount <=
						config.maxMergedWords
				) {
					for (const s of pendingShort.sentences) {
						appendToBlock(current, s);
						current.wordCount -= countWords(s.text); // Undo double-count
					}
					current.wordCount += pendingShort.wordCount;
				} else {
					if (current) blocks.push(current);
					current = pendingShort;
				}
				pendingShort = null;
			}
			if (current) {
				blocks.push(current);
				current = null;
			}
		}

		// If there's a pending short, try to merge it with this sentence
		if (pendingShort && !startsNewPara) {
			if (pendingShort.wordCount + wordCount <= config.maxMergedWords) {
				// Merge pending short with this sentence into current
				appendToBlock(pendingShort, sentence);
				if (current) blocks.push(current);
				current = pendingShort;
				pendingShort = null;
				// If in quote, keep accumulating
				if (!isInQuote) {
					blocks.push(current);
					current = null;
				}
				continue;
			}
			// Can't merge forward, try backward
			if (
				current &&
				current.wordCount + pendingShort.wordCount <=
					config.maxMergedWords
			) {
				for (const s of pendingShort.sentences) {
					appendToBlock(current, s);
					current.wordCount -= countWords(s.text);
				}
				current.wordCount += pendingShort.wordCount;
			} else {
				if (current) blocks.push(current);
				current = pendingShort;
			}
			pendingShort = null;
		}

		// If previous block was pending speech intro, merge this sentence
		if (current?.pendingSpeechIntro) {
			appendToBlock(current, sentence);
			current.pendingSpeechIntro = false;
			if (!isInQuote) {
				blocks.push(current);
				current = null;
			}
			continue;
		}

		// If in quoted region, accumulate
		if (isInQuote) {
			if (current) {
				appendToBlock(current, sentence);
			} else {
				current = newBlock(sentence);
			}
			continue;
		}

		// Check if this is a short speech intro
		if (isShortSpeechIntro(sentence, config.shortSentenceWords)) {
			if (current) blocks.push(current);
			current = newBlock(sentence, true);
			continue;
		}

		// Check if this is a short sentence - hold it pending to try merge with next
		// Note: We hold it pending regardless of whether IT starts a new paragraph,
		// because the check is whether the NEXT sentence is in the same paragraph.
		// Keep current around for potential backward merge if forward fails.
		if (isShort) {
			pendingShort = newBlock(sentence);
			// Don't push current to blocks yet - keep it for backward merge option
			continue;
		}

		// Regular sentence
		if (current) blocks.push(current);
		current = newBlock(sentence);
	}

	// Finalize any remaining pending short
	if (pendingShort) {
		if (
			current &&
			current.wordCount + pendingShort.wordCount <= config.maxMergedWords
		) {
			for (const s of pendingShort.sentences) {
				appendToBlock(current, s);
				current.wordCount -= countWords(s.text);
			}
			current.wordCount += pendingShort.wordCount;
		} else {
			if (current) blocks.push(current);
			current = pendingShort;
		}
	}

	if (current) blocks.push(current);

	return blocks;
}

/**
 * Horizontal rule with position info.
 */
type HorizontalRuleInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};

/**
 * Context for formatting blocks with headings and horizontal rules.
 */
type FormatContext = {
	headings: ExtractedHeading[];
	horizontalRules: HorizontalRuleInfo[];
	offsetMap: (filtered: number) => number;
	protectedToFiltered: (prot: number) => number;
	protectedItems: ProtectedContent[];
};

/**
 * Creates a mapping function from protected-text offsets to filtered-text offsets.
 * This is needed because:
 * - Sentences have sourceOffset relative to protected text (with placeholders)
 * - The heading offset map expects offsets relative to filtered text (before protection)
 * - Placeholders are shorter/longer than original content, shifting positions
 *
 * Example: URL "https://example.com" (19 chars) → placeholder "␜URL0␜" (6 chars)
 * If URL was at filtered offset 10, after protection:
 * - Placeholder is at protected offset 10
 * - Text after the URL shifts by (6 - 19) = -13 chars
 * - So protected offset 30 → filtered offset 30 + 13 = 43
 *
 * @param protectedItems - Items that were replaced with placeholders
 * @returns Function that maps protected-space offset to filtered-space offset
 */
function createProtectedToFilteredMap(
	protectedItems: ProtectedContent[],
): (protectedOffset: number) => number {
	if (protectedItems.length === 0) {
		return (offset) => offset;
	}

	// Sort by startOffset (position in filtered text where original content was)
	const sorted = [...protectedItems].sort(
		(a, b) => a.startOffset - b.startOffset,
	);

	// Pre-calculate where each placeholder starts/ends in protected text
	// and the cumulative offset adjustment after each
	type Replacement = {
		protectedStart: number; // Where placeholder starts in protected text
		protectedEnd: number; // Where placeholder ends in protected text
		filteredStart: number; // Where original started in filtered text
		filteredEnd: number; // Where original ended in filtered text
		cumulativeAdjustment: number; // Total adjustment for positions AFTER this replacement
	};

	const replacements: Replacement[] = [];
	let cumulativeShift = 0; // Total (originalLen - placeholderLen) for all prior replacements

	for (const item of sorted) {
		const placeholderLen = item.placeholder.length;
		const originalLen = item.original.length;

		// In protected text, this placeholder starts at:
		// filteredStart minus the cumulative shrinkage from prior replacements
		// (placeholders are typically shorter than originals, so positions shift left)
		const protectedStart = item.startOffset - cumulativeShift;
		const protectedEnd = protectedStart + placeholderLen;

		// Update cumulative shift with this replacement's contribution
		const thisAdjustment = originalLen - placeholderLen;
		cumulativeShift += thisAdjustment;

		replacements.push({
			cumulativeAdjustment: cumulativeShift,
			filteredEnd: item.startOffset + originalLen,
			filteredStart: item.startOffset,
			protectedEnd,
			protectedStart,
		});
	}

	return (protectedOffset: number) => {
		// Walk through replacements to find the right adjustment
		for (let i = replacements.length - 1; i >= 0; i--) {
			const r = replacements[i]!;

			if (protectedOffset >= r.protectedEnd) {
				// Position is after this replacement - apply cumulative adjustment
				return protectedOffset + r.cumulativeAdjustment;
			}

			if (protectedOffset >= r.protectedStart) {
				// Position is inside a placeholder - map to start of original content
				return r.filteredStart;
			}
		}

		// Position is before all replacements - no adjustment needed
		return protectedOffset;
	};
}

/**
 * Restore protected markdown content within sentence texts in blocks.
 * Also adjusts sourceOffset to map from protected-space to filtered-space,
 * so that the heading offset map works correctly.
 */
function restoreBlocksContent(
	blocks: Block[],
	protectedItems: ProtectedContent[],
): Block[] {
	if (protectedItems.length === 0) return blocks;

	const protectedToFiltered = createProtectedToFilteredMap(protectedItems);

	return blocks.map((block) => ({
		...block,
		sentences: block.sentences.map((s) => {
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
		}),
	}));
}

/**
 * Element that can be inserted: either a heading or a horizontal rule.
 */
type InsertableElement = {
	kind: "heading" | "hr";
	text: string;
	originalOffset: number; // Where it ends in original text (for headings) or where it is (for HRs)
};

/**
 * Find all headings and HRs that precede a given offset and haven't been used yet.
 * Returns them sorted by position in original document.
 */
function findAllPrecedingElements(
	sentenceOriginalOffset: number,
	headings: ExtractedHeading[],
	horizontalRules: HorizontalRuleInfo[],
	offsetMap: (filtered: number) => number,
	protectedToFiltered: (prot: number) => number,
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
	protectedItems: ProtectedContent[],
): InsertableElement[] {
	const result: InsertableElement[] = [];

	// Find all preceding headings
	for (let i = 0; i < headings.length; i++) {
		const heading = headings[i];
		if (!heading) continue;
		if (usedHeadings.has(i)) continue;

		if (heading.endOffset <= sentenceOriginalOffset) {
			result.push({
				kind: "heading",
				originalOffset: heading.endOffset,
				text: heading.text,
			});
			usedHeadings.add(i);
		}
	}

	// Find all preceding HRs
	for (let i = 0; i < horizontalRules.length; i++) {
		if (usedHRs.has(i)) continue;
		const hr = horizontalRules[i];
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
				kind: "hr",
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
 * Build block text with headings and HRs inserted before their corresponding sentences.
 * This handles the case where multiple elements should appear within a single block,
 * and also captures "orphaned" headings/HRs whose original content was filtered out.
 */
function buildBlockTextWithHeadings(
	sentences: AnnotatedSentence[],
	context: FormatContext | undefined,
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
): string {
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		// Find ALL headings and HRs that precede this sentence
		let precedingElements: InsertableElement[] = [];
		if (context) {
			const originalOffset = context.offsetMap(sentence.sourceOffset);
			precedingElements = findAllPrecedingElements(
				originalOffset,
				context.headings,
				context.horizontalRules,
				context.offsetMap,
				context.protectedToFiltered,
				usedHeadings,
				usedHRs,
				context.protectedItems,
			);
		}

		if (precedingElements.length > 0) {
			// Add all elements before this sentence
			const elementsText = precedingElements
				.map((e) => e.text)
				.join("\n");
			if (i === 0) {
				parts.push(`${elementsText}\n${sentence.text}`);
			} else {
				parts.push(`\n${elementsText}\n${sentence.text}`);
			}
		} else {
			parts.push(sentence.text);
		}
	}

	return parts.join("");
}

/**
 * Format blocks into marked text with block IDs.
 * Preserves paragraph spacing by adding extra blank lines between paragraph-crossing blocks.
 * Reinserts headings before their corresponding content.
 * Reinserts horizontal rules between blocks (without block markers).
 */
function formatBlocksWithMarkers(
	blocks: Block[],
	startIndex: number,
	context?: FormatContext,
): string {
	if (blocks.length === 0) return "";

	const parts: string[] = [];
	const usedHeadings = new Set<number>();
	const usedHRs = new Set<number>();

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (!block) continue;

		// Build block text with headings and HRs inserted for each sentence
		const blockText = buildBlockTextWithHeadings(
			block.sentences,
			context,
			usedHeadings,
			usedHRs,
		).trim();
		const blockId = startIndex + i;
		const markedBlock = `${blockText} ^${blockId}`;

		if (i === 0) {
			parts.push(markedBlock);
			continue;
		}

		// Check if this block starts a new paragraph
		const firstSentence = block.sentences[0];
		const startsNewParagraph = firstSentence?.startsNewParagraph ?? false;

		if (startsNewParagraph) {
			// Extra blank lines for paragraph boundary (3 blank lines = 4 newlines)
			parts.push(`\n\n\n\n${markedBlock}`);
		} else {
			// Standard single blank line between blocks
			parts.push(`\n\n${markedBlock}`);
		}
	}

	return parts.join("");
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

	// Create offset mapping for later heading placement
	const offsetMap = createOffsetMap(headings);

	// Scan the protected text for proper line metadata
	const filteredLines = scanLines(safeText, fullConfig.languageConfig);

	// Run pipeline stages 2-3 on protected text
	const sentenceTokens = segmentSentences(
		safeText,
		fullConfig.languageConfig,
	);
	const annotated = annotateSentences(
		sentenceTokens,
		filteredLines,
		safeText,
		fullConfig.languageConfig,
	);

	// Filter out blank "sentences" (whitespace-only) and horizontal rules
	// Horizontal rules will be reinserted during formatting
	const horizontalRules: {
		sentence: AnnotatedSentence;
		originalIndex: number;
	}[] = [];
	const filtered: AnnotatedSentence[] = [];

	for (let i = 0; i < annotated.length; i++) {
		const s = annotated[i]!;
		const trimmed = s.text.trim();
		if (trimmed.length === 0) {
			continue; // Skip blank
		}
		if (isHorizontalRule(trimmed)) {
			horizontalRules.push({ originalIndex: i, sentence: s });
			continue; // Skip HR from main pipeline
		}
		filtered.push(s);
	}

	// Re-detect paragraph boundaries after filtering
	const withParagraphs = detectParagraphsAfterFilter(filtered, safeText);

	// Merge orphaned markdown markers with previous sentence
	const withOrphansMerged = mergeOrphanedMarkers(withParagraphs);

	// Group sentences into blocks
	const blocks = groupSentencesIntoBlocks(withOrphansMerged, fullConfig);

	// Restore protected content in blocks BEFORE heading insertion.
	// This is critical: the offset map only accounts for heading removal.
	// If we insert headings while text contains placeholders, offsets are wrong
	// because placeholder lengths differ from original content lengths.
	const blocksWithRestoredContent = restoreBlocksContent(
		blocks,
		protectedItems,
	);

	// Create protected-to-filtered offset map for HR placement
	const protectedToFiltered = createProtectedToFilteredMap(protectedItems);

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
