import {
	locateSentences,
	splitPlainText,
} from "../../../../../stateless-helpers/dumgen-sentences";
import type { RawContentToken, SentenceToken } from "../../types";
import { isCodeBlock, isHorizontalRule } from "../block-marker/text-patterns";

/**
 * Sentence-ending punctuation pattern.
 * Matches period, exclamation, or question mark optionally followed by closing quotes.
 */
const SENTENCE_ENDING = /[.!?]["»«"']?\s*$/;

/**
 * Checks if text ends with complete sentence punctuation.
 */
function isCompleteSentence(text: string): boolean {
	return SENTENCE_ENDING.test(text.trim());
}

/**
 * A horizontal rule or a protected code block on a line of its own stays
 * a "sentence" of its own, so the block formatter can set it apart without
 * a marker. dumgen would join such a line with a hard-wrapped neighbour,
 * so it gets a blank line on either side before splitting. Only whitespace
 * is added, which locating the Sentences ignores.
 */
function isolateStandaloneLines(content: string): string {
	return content
		.split("\n")
		.map((line) =>
			isHorizontalRule(line) || isCodeBlock(line) ? `\n${line}\n` : line,
		)
		.join("\n");
}

/**
 * Stage 2: Sentence Segmenter
 * Splits with dumgen's `splitText`, the plugin's only sentence splitter
 * (ADR 0014), so every `^N` block is one whole dumgen Sentence. Each
 * token's text runs from its Sentence's first character to the next
 * Sentence's, trailing whitespace included, so the tokens put together
 * give the content back from the first Sentence on.
 */
export function segmentSentences(content: string): SentenceToken[] {
	const sentences = splitPlainText(isolateStandaloneLines(content)).flat();
	const located = locateSentences(content, sentences);
	return located.map(({ start }, index) => {
		const end = located[index + 1]?.start ?? content.length;
		const text = content.slice(start, end);
		return {
			charCount: text.length,
			isComplete: isCompleteSentence(text),
			sourceOffset: start,
			text,
		};
	});
}

/**
 * Segments text into content tokens, emitting explicit paragraph break markers.
 * Returns a mix of sentence tokens and paragraph break tokens.
 */
export function segmentToTokens(content: string): RawContentToken[] {
	const tokens: RawContentToken[] = [];
	const sentences = segmentSentences(content);

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		const prevSentence = sentences[i - 1];

		// Check if there's a paragraph break before this sentence
		// Look at the range from end of previous sentence's non-whitespace content
		// to start of this sentence
		if (prevSentence) {
			// Find where the actual content ends (excluding trailing whitespace)
			const prevTrimmedLen = prevSentence.text.trimEnd().length;
			const prevContentEnd = prevSentence.sourceOffset + prevTrimmedLen;
			const gap = content.slice(prevContentEnd, sentence.sourceOffset);

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
