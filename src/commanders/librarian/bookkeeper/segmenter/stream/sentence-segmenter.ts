import type { RawContentToken, SentenceToken } from "../../types";
import type { LanguageConfig } from "../language-config";

/**
 * Sentence-ending punctuation pattern.
 * Matches period, exclamation, or question mark optionally followed by closing quotes.
 */
const SENTENCE_ENDING = /[.!?]["»«"']?\s*$/;

/**
 * Colon-as-sentence-end pattern.
 * Colon followed by space and then quote/uppercase/dash indicates sentence break.
 * Based on split-on-colon.ts logic.
 */
const COLON_SENTENCE_BREAK =
	/(?<!\p{Nd}):\s+(?!\/\/)(?=(\p{Quotation_Mark}|[\p{Lu}\p{Lt}]|[\p{Dash_Punctuation}—–-]))/gu;

/**
 * Checks if text ends with complete sentence punctuation.
 */
function isCompleteSentence(text: string): boolean {
	return SENTENCE_ENDING.test(text.trim());
}

/**
 * Pre-processes text to add markers at colon sentence boundaries.
 * This helps Intl.Segmenter recognize German speech patterns like:
 * "Die Mutter sprach: „Geh nach Hause!""
 */
function preprocessColons(text: string): string {
	// Insert a zero-width space after colons that introduce speech
	// This helps the segmenter recognize the boundary
	return text.replace(COLON_SENTENCE_BREAK, ":\u200B ");
}

/**
 * Stage 2: Sentence Segmenter
 * Uses Intl.Segmenter with colon preprocessing for German text.
 */
export function segmentSentences(
	content: string,
	config: LanguageConfig,
): SentenceToken[] {
	const segmenter = new Intl.Segmenter(config.locale, {
		granularity: "sentence",
	});

	// Preprocess colons for better sentence detection
	const preprocessed = preprocessColons(content);
	const segments = [...segmenter.segment(preprocessed)];

	const sentences: SentenceToken[] = [];
	let sourceOffset = 0;

	for (const segment of segments) {
		// Remove zero-width spaces that were added during preprocessing
		const text = segment.segment.replace(/\u200B/g, "");

		if (text.length === 0) continue;

		sentences.push({
			charCount: text.length,
			isComplete: isCompleteSentence(text),
			sourceOffset,
			text,
		});

		sourceOffset += text.length;
	}

	return sentences;
}

/**
 * Segments text preserving paragraph structure.
 * Returns sentences with paragraph boundary markers (legacy version).
 */
export function segmentWithParagraphs(
	content: string,
	config: LanguageConfig,
): SentenceToken[] {
	// Split on double newlines (paragraph breaks)
	const paragraphs = content.split(/\n\n+/);
	const sentences: SentenceToken[] = [];
	let sourceOffset = 0;

	for (let i = 0; i < paragraphs.length; i++) {
		const para = paragraphs[i];
		if (para === undefined) continue;

		const paraSentences = segmentSentences(para, config);

		for (const sent of paraSentences) {
			sentences.push({
				...sent,
				sourceOffset: sourceOffset + sent.sourceOffset,
			});
		}

		// Account for the paragraph text and paragraph break
		sourceOffset += para.length;
		if (i < paragraphs.length - 1) {
			sourceOffset += 2; // "\n\n"
		}
	}

	return sentences;
}

/**
 * Segments text into content tokens, emitting explicit paragraph break markers.
 * Returns a mix of sentence tokens and paragraph break tokens.
 */
export function segmentToTokens(
	content: string,
	config: LanguageConfig,
): RawContentToken[] {
	const tokens: RawContentToken[] = [];
	const sentences = segmentSentences(content, config);

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		const prevSentence = sentences[i - 1];

		// Check if there's a paragraph break before this sentence
		if (prevSentence) {
			const gapStart = prevSentence.sourceOffset + prevSentence.charCount;
			const gapEnd = sentence.sourceOffset;
			const gap = content.slice(gapStart, gapEnd);

			// Paragraph break = two consecutive newlines (with optional whitespace between)
			if (/\n\s*\n/.test(gap)) {
				tokens.push({ kind: "paragraphBreak" });
			}
		}

		// Trim trailing newlines from sentence text but keep leading content
		const trimmedText = sentence.text.replace(/\n+$/, "");

		tokens.push({
			kind: "sentence",
			sentence: {
				...sentence,
				charCount: trimmedText.length,
				text: trimmedText,
			},
		});
	}

	return tokens;
}
