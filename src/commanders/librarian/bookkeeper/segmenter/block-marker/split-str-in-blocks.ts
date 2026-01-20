import type { AnnotatedSentence, ScannedLine } from "../../types";
import {
	DEFAULT_LANGUAGE_CONFIG,
	type LanguageConfig,
} from "../language-config";
import { annotateSentences } from "../stream/context-annotator";
import { scanLines } from "../stream/line-scanner";
import { segmentSentences } from "../stream/sentence-segmenter";

/**
 * A heading extracted from content with its position info.
 */
type ExtractedHeading = {
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
function extractHeadings(lines: ScannedLine[]): ExtractedHeading[] {
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
function filterHeadingsFromText(
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
function findPrecedingHeading(
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
		if (usedHeadings.has(i)) continue;

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
function createOffsetMap(
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
 * Combine sentences into text.
 */
function combineSentences(sentences: AnnotatedSentence[]): string {
	return sentences.map((s) => s.text).join("");
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
 * Context for formatting blocks with headings.
 */
type FormatContext = {
	headings: ExtractedHeading[];
	offsetMap: (filtered: number) => number;
};

/**
 * Format blocks into marked text with block IDs.
 * Preserves paragraph spacing by adding extra blank lines between paragraph-crossing blocks.
 * Reinserts headings before their corresponding content blocks.
 */
function formatBlocksWithMarkers(
	blocks: Block[],
	startIndex: number,
	context?: FormatContext,
): string {
	if (blocks.length === 0) return "";

	const parts: string[] = [];
	const usedHeadings = new Set<number>();

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (!block) continue;

		const blockText = combineSentences(block.sentences).trim();
		const blockId = startIndex + i;
		const markedBlock = `${blockText} ^${blockId}`;

		// Find preceding heading for this block
		let precedingHeading: ExtractedHeading | null = null;
		if (context && block.sentences[0]) {
			const firstSentenceOffset = block.sentences[0].sourceOffset;
			// Map back to original offset to find the correct heading
			const originalOffset = context.offsetMap(firstSentenceOffset);
			precedingHeading = findPrecedingHeading(
				originalOffset,
				context.headings,
				usedHeadings,
			);
		}

		if (i === 0) {
			if (precedingHeading) {
				parts.push(`${precedingHeading.text}\n${markedBlock}`);
			} else {
				parts.push(markedBlock);
			}
			continue;
		}

		// Check if this block starts a new paragraph
		const firstSentence = block.sentences[0];
		const startsNewParagraph = firstSentence?.startsNewParagraph ?? false;

		const separator = startsNewParagraph ? "\n\n\n\n" : "\n\n";

		if (precedingHeading) {
			parts.push(`${separator}${precedingHeading.text}\n${markedBlock}`);
		} else if (startsNewParagraph) {
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

	// Create offset mapping for later heading placement
	const offsetMap = createOffsetMap(headings);

	// Scan the filtered text for proper line metadata
	const filteredLines = scanLines(filteredText, fullConfig.languageConfig);

	// Run pipeline stages 2-3 on filtered text
	const sentenceTokens = segmentSentences(
		filteredText,
		fullConfig.languageConfig,
	);
	const annotated = annotateSentences(
		sentenceTokens,
		filteredLines,
		filteredText,
		fullConfig.languageConfig,
	);

	// Filter out blank "sentences" (whitespace-only)
	const filtered = annotated.filter((s) => s.text.trim().length > 0);

	// Re-detect paragraph boundaries after filtering
	const withParagraphs = detectParagraphsAfterFilter(filtered, filteredText);

	// Group sentences into blocks
	const blocks = groupSentencesIntoBlocks(withParagraphs, fullConfig);

	// Format with markers and reinsert headings
	const formatContext: FormatContext =
		headings.length > 0
			? { headings, offsetMap }
			: { headings: [], offsetMap };
	const markedText = formatBlocksWithMarkers(
		blocks,
		startIndex,
		formatContext,
	);

	return {
		blockCount: blocks.length,
		markedText,
	};
}
