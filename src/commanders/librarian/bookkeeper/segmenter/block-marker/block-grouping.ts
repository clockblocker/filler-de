/**
 * Block Grouping
 *
 * Groups sentences into blocks according to merging rules.
 */

import type { AnnotatedSentence } from "../../types";
import {
	countWords,
	isOrphanedMarker,
	isShortSpeechIntro,
	isStandaloneUrl,
} from "./text-patterns";
import type { BlockMarkerConfig } from "./types";

/**
 * Internal block representation during grouping.
 */
export type Block = {
	sentences: AnnotatedSentence[];
	wordCount: number;
	/** Character count of all sentences in block (for page accumulation) */
	charCount: number;
	/** True if this block is a short speech intro waiting for next sentence */
	pendingSpeechIntro: boolean;
};

/**
 * Create a new block with one sentence.
 */
export function newBlock(
	sentence: AnnotatedSentence,
	pendingSpeechIntro = false,
): Block {
	return {
		charCount: sentence.charCount,
		pendingSpeechIntro,
		sentences: [sentence],
		wordCount: countWords(sentence.text),
	};
}

/**
 * Append sentence to block.
 */
export function appendToBlock(block: Block, sentence: AnnotatedSentence): void {
	block.sentences.push(sentence);
	block.wordCount += countWords(sentence.text);
	block.charCount += sentence.charCount;
}

/**
 * Merge orphaned markdown markers (lone `*`, `**`, etc.) with the previous sentence.
 * These are artifacts from italics/bold spanning multiple sentences.
 */
export function mergeOrphanedMarkers(
	sentences: AnnotatedSentence[],
): AnnotatedSentence[] {
	const result: AnnotatedSentence[] = [];
	for (const sentence of sentences) {
		if (isOrphanedMarker(sentence.text.trim())) {
			const prev = result[result.length - 1];
			if (prev) {
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
 * Re-detect paragraph boundaries after filtering out blank sentences.
 * Checks for blank lines (double newlines) between consecutive sentences.
 */
export function detectParagraphsAfterFilter(
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
 * Group annotated sentences into blocks according to rules:
 * 1. Never merge across paragraph boundaries
 * 2. Direct speech (quoteDepth > 0) stays together
 * 3. Short speech intro (≤4 words + ":") merges with following sentence
 * 4. Short sentences (≤4 words) try to merge with next, else with previous
 * 5. Merged blocks cannot exceed maxMergedWords
 */
export function groupSentencesIntoBlocks(
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

		// Standalone URLs get their own block - never merge with adjacent content
		if (isStandaloneUrl(sentence.text)) {
			if (current) blocks.push(current);
			blocks.push(newBlock(sentence));
			current = null;
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
