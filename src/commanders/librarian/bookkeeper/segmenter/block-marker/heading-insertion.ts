/**
 * Heading Insertion
 *
 * Reinserts headings and horizontal rules into formatted output.
 */

import type { AnnotatedSentence } from "../../types";
import type { ProtectedContent } from "../stream/markdown-protector";
import { restoreProtectedContent } from "../stream/markdown-protector";
import type { ExtractedHeading } from "./heading-extraction";

/**
 * Horizontal rule with position info.
 */
export type HorizontalRuleInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};

/**
 * Code block with position info.
 */
export type CodeBlockInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};

/**
 * Element that can be inserted: heading, horizontal rule, or code block.
 */
export type InsertableElement = {
	kind: "heading" | "hr" | "codeblock";
	text: string;
	originalOffset: number; // Where it ends in original text (for headings) or where it is (for HRs/code blocks)
};

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
 * Find all headings, HRs, and code blocks that precede a given offset and haven't been used yet.
 * Returns them sorted by position in original document.
 */
export function findAllPrecedingElements(
	sentenceOriginalOffset: number,
	headings: ExtractedHeading[],
	horizontalRules: HorizontalRuleInfo[],
	offsetMap: (filtered: number) => number,
	protectedToFiltered: (prot: number) => number,
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
	protectedItems: ProtectedContent[],
	codeBlocks?: CodeBlockInfo[],
	usedCodeBlocks?: Set<number>,
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

	// Find all preceding code blocks
	if (codeBlocks && usedCodeBlocks) {
		for (let i = 0; i < codeBlocks.length; i++) {
			if (usedCodeBlocks.has(i)) continue;
			const cb = codeBlocks[i];
			if (!cb) continue;

			// Convert code block offset: protected -> filtered -> original
			const cbFilteredOffset = protectedToFiltered(
				cb.sentence.sourceOffset,
			);
			const cbOriginalOffset = offsetMap(cbFilteredOffset);

			if (cbOriginalOffset <= sentenceOriginalOffset) {
				// Restore the code block text from placeholder
				const cbText = restoreProtectedContent(
					cb.sentence.text.trim(),
					protectedItems,
				);
				result.push({
					kind: "codeblock",
					originalOffset: cbOriginalOffset,
					text: cbText,
				});
				usedCodeBlocks.add(i);
			}
		}
	}

	// Sort by original offset to maintain document order
	result.sort((a, b) => a.originalOffset - b.originalOffset);
	return result;
}

/**
 * Context for building block text with headings.
 */
export type HeadingInsertionContext = {
	headings: ExtractedHeading[];
	horizontalRules: HorizontalRuleInfo[];
	codeBlocks: CodeBlockInfo[];
	offsetMap: (filtered: number) => number;
	protectedToFiltered: (prot: number) => number;
	protectedItems: ProtectedContent[];
};

/**
 * Collect all remaining unused elements (HRs, code blocks) that weren't inserted
 * before any sentence. These are "trailing" elements that come at the end of content.
 * Returns them sorted by original offset.
 */
export function collectTrailingElements(
	context: HeadingInsertionContext,
	usedHRs: Set<number>,
	usedCodeBlocks: Set<number>,
): InsertableElement[] {
	const result: InsertableElement[] = [];

	// Collect unused HRs
	for (let i = 0; i < context.horizontalRules.length; i++) {
		if (usedHRs.has(i)) continue;
		const hr = context.horizontalRules[i];
		if (!hr) continue;

		const hrFilteredOffset = context.protectedToFiltered(
			hr.sentence.sourceOffset,
		);
		const hrOriginalOffset = context.offsetMap(hrFilteredOffset);

		const hrText = restoreProtectedContent(
			hr.sentence.text.trim(),
			context.protectedItems,
		);
		result.push({
			kind: "hr",
			originalOffset: hrOriginalOffset,
			text: hrText,
		});
		usedHRs.add(i);
	}

	// Collect unused code blocks
	for (let i = 0; i < context.codeBlocks.length; i++) {
		if (usedCodeBlocks.has(i)) continue;
		const cb = context.codeBlocks[i];
		if (!cb) continue;

		const cbFilteredOffset = context.protectedToFiltered(
			cb.sentence.sourceOffset,
		);
		const cbOriginalOffset = context.offsetMap(cbFilteredOffset);

		const cbText = restoreProtectedContent(
			cb.sentence.text.trim(),
			context.protectedItems,
		);
		result.push({
			kind: "codeblock",
			originalOffset: cbOriginalOffset,
			text: cbText,
		});
		usedCodeBlocks.add(i);
	}

	// Sort by original offset to maintain document order
	result.sort((a, b) => a.originalOffset - b.originalOffset);
	return result;
}

/**
 * Build block text with headings, HRs, and code blocks inserted before their corresponding sentences.
 * This handles the case where multiple elements should appear within a single block,
 * and also captures "orphaned" headings/HRs/code blocks whose original content was filtered out.
 */
export function buildBlockTextWithHeadings(
	sentences: AnnotatedSentence[],
	context: HeadingInsertionContext | undefined,
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
	usedCodeBlocks?: Set<number>,
): string {
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		if (!sentence) continue;

		// Find ALL headings, HRs, and code blocks that precede this sentence
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
				context.codeBlocks,
				usedCodeBlocks,
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
