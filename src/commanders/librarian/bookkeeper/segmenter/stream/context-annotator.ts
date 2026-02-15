import type {
	AnnotatedSentence,
	ContentToken,
	RawContentToken,
	RegionKind,
	ScannedLine,
	SentenceToken,
} from "../../types";
import type { LanguageConfig } from "../language-config";

/**
 * Finds quote depth at a given character offset by scanning lines.
 */
function findQuoteDepthAtOffset(lines: ScannedLine[], offset: number): number {
	let charsSoFar = 0;

	for (const line of lines) {
		const lineLength = line.text.length + 1; // +1 for newline
		if (charsSoFar + lineLength > offset) {
			// Offset is within this line
			// Return the quote depth at the start of this line
			// (i.e., the depth after the previous line)
			const prevLineIndex = lines.indexOf(line) - 1;
			if (prevLineIndex >= 0) {
				const prevLine = lines[prevLineIndex];
				return prevLine?.quoteStateAfter.depth ?? 0;
			}
			return 0;
		}
		charsSoFar += lineLength;
	}

	// Beyond content - use last line's state
	const lastLine = lines[lines.length - 1];
	return lastLine?.quoteStateAfter.depth ?? 0;
}

/**
 * Checks if a sentence is part of a poem by examining its structure.
 * Poems typically have:
 * - Markdown line breaks (two trailing spaces)
 * - Short lines
 * - Multiple consecutive short lines
 */
function detectPoemSentence(
	sentence: SentenceToken,
	_lines: ScannedLine[],
	config: LanguageConfig,
): boolean {
	const text = sentence.text;

	// Check for markdown line break
	for (const pattern of config.poemIndicators.linePatterns) {
		if (pattern.test(text)) return true;
	}

	// Check if sentence is composed of multiple short lines
	const sentenceLines = text.split("\n");
	if (sentenceLines.length >= 2) {
		const shortLines = sentenceLines.filter(
			(l) =>
				l.trim().length > 0 &&
				l.trim().length < config.poemIndicators.maxLineLength,
		);
		if (shortLines.length >= 2) return true;
	}

	return false;
}

/**
 * Determines if a sentence starts a new paragraph by checking for preceding blank lines.
 */
function startsNewParagraph(
	sentence: SentenceToken,
	prevSentence: SentenceToken | undefined,
	content: string,
): boolean {
	if (!prevSentence) return true; // First sentence starts new paragraph

	// Check if there's a blank line between sentences
	const gapStart = prevSentence.sourceOffset + prevSentence.charCount;
	const gapEnd = sentence.sourceOffset;
	const gap = content.slice(gapStart, gapEnd);

	return /\n\s*\n/.test(gap);
}

/**
 * Detects region kind for a sentence.
 */
function detectRegion(
	sentence: SentenceToken,
	quoteDepth: number,
	isPoem: boolean,
	prevSentence: AnnotatedSentence | undefined,
): RegionKind | null {
	// Continue previous region if still valid
	if (prevSentence?.inRegion) {
		if (prevSentence.inRegion === "poem" && isPoem) return "poem";
		if (prevSentence.inRegion === "multilineQuote" && quoteDepth > 0)
			return "multilineQuote";
	}

	// Start new region
	if (isPoem) return "poem";
	if (quoteDepth > 0) return "multilineQuote";

	// Check for speech intro (ends with ":")
	if (sentence.text.trim().endsWith(":")) return "speechIntro";

	return null;
}

/**
 * Stage 3: Context Annotator
 * Annotates sentences with quote depth, region markers, and structure info.
 */
export function annotateSentences(
	sentences: SentenceToken[],
	lines: ScannedLine[],
	content: string,
	config: LanguageConfig,
): AnnotatedSentence[] {
	const annotated: AnnotatedSentence[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		const prevSentence = sentences[i - 1];
		const prevAnnotated = annotated[i - 1];

		const quoteDepth = findQuoteDepthAtOffset(lines, sentence.sourceOffset);
		const isPoem = detectPoemSentence(sentence, lines, config);
		const startsNew = startsNewParagraph(sentence, prevSentence, content);
		const inRegion = detectRegion(
			sentence,
			quoteDepth,
			isPoem,
			prevAnnotated,
		);

		annotated.push({
			...sentence,
			inRegion,
			isPoem,
			quoteDepth,
			startsNewParagraph: startsNew,
		});
	}

	return annotated;
}

/**
 * Stage 3 (token-based): Context Annotator
 * Annotates sentence tokens, passes through paragraph breaks unchanged.
 */
export function annotateTokens(
	tokens: RawContentToken[],
	lines: ScannedLine[],
	config: LanguageConfig,
): ContentToken[] {
	const result: ContentToken[] = [];
	let prevAnnotated: AnnotatedSentence | undefined;

	for (const token of tokens) {
		if (token.kind === "paragraphBreak") {
			result.push({ kind: "paragraphBreak" });
			continue;
		}

		const sentence = token.sentence;
		const quoteDepth = findQuoteDepthAtOffset(lines, sentence.sourceOffset);
		const isPoem = detectPoemSentence(sentence, lines, config);
		const inRegion = detectRegion(
			sentence,
			quoteDepth,
			isPoem,
			prevAnnotated,
		);

		const annotated: AnnotatedSentence = {
			...sentence,
			inRegion,
			isPoem,
			quoteDepth,
			// With tokens, paragraph breaks are explicit; first sentence always starts new
			startsNewParagraph: prevAnnotated === undefined,
		};

		result.push({ kind: "sentence", sentence: annotated });
		prevAnnotated = annotated;
	}

	return result;
}
