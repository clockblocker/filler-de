/**
 * Sentence Blocks
 *
 * Every Sentence becomes a block of its own, so every `^N` names exactly
 * one Sentence and an Attestation that embeds it shows that Sentence.
 * Nothing is grouped: not short Sentences, not direct speech, not a speech
 * intro with its quote.
 */

import type { AnnotatedSentence } from "../../types";
import { isOrphanedMarker } from "./text-patterns";

/**
 * One block: one Sentence.
 */
export type Block = {
	sentence: AnnotatedSentence;
	/** The Sentence's character count (for page accumulation) */
	charCount: number;
};

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
 * What opens a Sentence but closes the one before it: footnote reference
 * placeholders (from markdown-protector) and decoration markers followed
 * by a blank, which can only close emphasis, with the blanks after them.
 */
const LEADING_CLOSERS =
	/^(?:\uFFFCFN\d+\uFFFC|(?:\*{1,3}|_{1,3}|~~|==)(?=\s|$|\uFFFC))+[ \t]*/u;

/**
 * dumgen ends a Sentence at its punctuation, before a footnote reference or
 * a closing `*` that follows it: `Er ging.[^1] Sie blieb.`, `*Er ging.* Sie
 * blieb.` Both would open the next block. They belong to the Sentence
 * before them, as the reader sees it.
 */
export function attachLeadingClosers(
	sentences: AnnotatedSentence[],
): AnnotatedSentence[] {
	const result: AnnotatedSentence[] = [];
	for (const sentence of sentences) {
		const prev = result[result.length - 1];
		const lead = LEADING_CLOSERS.exec(sentence.text)?.[0];
		if (!prev || !lead || sentence.startsNewParagraph) {
			result.push(sentence);
			continue;
		}
		result[result.length - 1] = {
			...prev,
			charCount: prev.charCount + lead.length,
			text: prev.text + lead,
		};
		const rest = sentence.text.slice(lead.length);
		if (!rest.trim()) continue;
		result.push({
			...sentence,
			charCount: rest.length,
			sourceOffset: sentence.sourceOffset + lead.length,
			text: rest,
		});
	}
	return result;
}

/** One block per Sentence, in order. */
export function sentenceBlocksOf(sentences: AnnotatedSentence[]): Block[] {
	return sentences.map((sentence) => ({
		charCount: sentence.charCount,
		sentence,
	}));
}
