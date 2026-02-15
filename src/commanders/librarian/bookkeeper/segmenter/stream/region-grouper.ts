import type { NonEmptyArray } from "../../../../../types/helpers";
import { nonEmptyArrayResult } from "../../../../../types/utils";
import type {
	AnnotatedSentence,
	ContentToken,
	SentenceGroup,
} from "../../types";

/**
 * Detects if a sentence looks like a verse line (short, potentially poetic).
 */
function looksLikeVerseLine(sentence: AnnotatedSentence): boolean {
	const trimmed = sentence.text.trim();
	// Short lines (under 80 chars) that don't look like normal prose
	if (trimmed.length < 80 && trimmed.length > 0) {
		// Has markdown line break
		if (/ {2}$/.test(sentence.text)) return true;
		// Is a short fragment (no ending punctuation typical of prose)
		if (!/[.!?]\s*["»«"\u201D]?\s*$/.test(trimmed)) return true;
		// Ends with exclamation inside quote (common for poems/songs)
		if (/[!]"?\s*$/.test(trimmed) && trimmed.length < 50) return true;
	}
	return false;
}

/**
 * Checks if two sentences should be in the same group.
 */
function shouldGroupTogether(
	current: AnnotatedSentence,
	next: AnnotatedSentence,
): boolean {
	// Keep poem sentences together
	if (current.isPoem && next.isPoem) return true;

	// Keep consecutive verse-like lines together (even if not formally detected as poem)
	if (looksLikeVerseLine(current) && looksLikeVerseLine(next)) return true;

	// If current ends with markdown line break, keep with next
	if (/ {2}$/.test(current.text) || / {2}\n/.test(current.text)) return true;

	// Keep multiline quotes together
	if (
		current.inRegion === "multilineQuote" &&
		next.inRegion === "multilineQuote"
	)
		return true;

	// Keep speech intro with following sentence
	if (current.inRegion === "speechIntro") return true;

	// If current ends with colon introducing quoted content, keep together
	if (current.text.trim().endsWith(":") && next.quoteDepth > 0) return true;

	// Don't group across paragraph boundaries (unless in special region)
	if (
		next.startsNewParagraph &&
		!current.isPoem &&
		current.quoteDepth === 0
	) {
		return false;
	}

	return false;
}

/**
 * Determines if a group is splittable.
 * Poems, verses, and multiline quotes should not be split.
 */
function isGroupSplittable(
	sentences: NonEmptyArray<AnnotatedSentence>,
): boolean {
	// If any sentence is a poem, group is not splittable
	if (sentences.some((s) => s.isPoem)) return false;

	// If any sentence looks like a verse line, group is not splittable
	if (sentences.some((s) => looksLikeVerseLine(s))) return false;

	// If all sentences are in a multiline quote, group is not splittable
	if (sentences.every((s) => s.inRegion === "multilineQuote")) return false;

	// If it's a speech intro group, not splittable
	if (sentences.some((s) => s.inRegion === "speechIntro")) return false;

	return true;
}

/**
 * Calculates total character count for a group.
 */
function calculateGroupCharCount(
	sentences: NonEmptyArray<AnnotatedSentence>,
): number {
	return sentences.reduce((sum, s) => sum + s.charCount, 0);
}

/**
 * Stage 4: Region Grouper
 * Groups sentences that should be kept together (poems, multiline quotes).
 */
export function groupSentences(
	sentences: AnnotatedSentence[],
): SentenceGroup[] {
	if (sentences.length === 0) return [];

	const groups: SentenceGroup[] = [];
	let currentGroup: AnnotatedSentence[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		// First sentence always starts a group
		if (currentGroup.length === 0) {
			currentGroup.push(sentence);
			continue;
		}

		const lastSentence = currentGroup[currentGroup.length - 1];
		if (!lastSentence) {
			currentGroup.push(sentence);
			continue;
		}

		// Check if this sentence should be grouped with the previous
		if (shouldGroupTogether(lastSentence, sentence)) {
			currentGroup.push(sentence);
		} else {
			// Finish current group and start new one
			const nonEmpty = nonEmptyArrayResult(currentGroup);
			if (nonEmpty.isOk()) {
				groups.push({
					charCount: calculateGroupCharCount(nonEmpty.value),
					isSplittable: isGroupSplittable(nonEmpty.value),
					sentences: nonEmpty.value,
				});
			}
			currentGroup = [sentence];
		}
	}

	// Don't forget the last group
	const nonEmpty = nonEmptyArrayResult(currentGroup);
	if (nonEmpty.isOk()) {
		groups.push({
			charCount: calculateGroupCharCount(nonEmpty.value),
			isSplittable: isGroupSplittable(nonEmpty.value),
			sentences: nonEmpty.value,
		});
	}

	return groups;
}

/**
 * Flattens groups back to sentences (for compatibility).
 */
export function flattenGroups(groups: SentenceGroup[]): AnnotatedSentence[] {
	return groups.flatMap((g) => g.sentences);
}

/**
 * Stage 4 (token-based): Region Grouper
 * Groups content tokens, with paragraph breaks forcing group boundaries.
 * Returns groups that track whether they follow a paragraph break.
 */
export function groupTokens(tokens: ContentToken[]): SentenceGroup[] {
	if (tokens.length === 0) return [];

	const groups: SentenceGroup[] = [];
	let currentGroup: AnnotatedSentence[] = [];
	let afterParagraphBreak = false;

	for (const token of tokens) {
		if (token.kind === "paragraphBreak") {
			// Finish current group if non-empty
			const nonEmpty = nonEmptyArrayResult(currentGroup);
			if (nonEmpty.isOk()) {
				const group = createGroup(nonEmpty.value, afterParagraphBreak);
				groups.push(group);
			}
			currentGroup = [];
			afterParagraphBreak = true;
			continue;
		}

		const sentence = token.sentence;

		// First sentence in group
		if (currentGroup.length === 0) {
			currentGroup.push(sentence);
			continue;
		}

		const lastSentence = currentGroup[currentGroup.length - 1];
		if (!lastSentence) {
			currentGroup.push(sentence);
			continue;
		}

		// Check if this sentence should be grouped with previous
		if (shouldGroupTogether(lastSentence, sentence)) {
			currentGroup.push(sentence);
		} else {
			// Finish current group and start new one
			const nonEmpty = nonEmptyArrayResult(currentGroup);
			if (nonEmpty.isOk()) {
				const group = createGroup(nonEmpty.value, afterParagraphBreak);
				groups.push(group);
				afterParagraphBreak = false;
			}
			currentGroup = [sentence];
		}
	}

	// Don't forget the last group
	const nonEmpty = nonEmptyArrayResult(currentGroup);
	if (nonEmpty.isOk()) {
		const group = createGroup(nonEmpty.value, afterParagraphBreak);
		groups.push(group);
	}

	return groups;
}

/**
 * Creates a SentenceGroup with paragraph boundary tracking.
 */
function createGroup(
	sentences: NonEmptyArray<AnnotatedSentence>,
	afterParagraphBreak: boolean,
): SentenceGroup {
	// Mark the first sentence as starting a new paragraph if after a break
	if (afterParagraphBreak && sentences.length > 0) {
		sentences[0] = { ...sentences[0], startsNewParagraph: true };
	}
	return {
		charCount: calculateGroupCharCount(sentences),
		isSplittable: isGroupSplittable(sentences),
		sentences,
	};
}
