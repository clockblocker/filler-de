/**
 * Heading Insertion
 *
 * Reinserts headings and horizontal rules into formatted output.
 */

import type { ProtectedContent } from "../stream/markdown-protector";
import { restoreProtectedContent } from "../stream/markdown-protector";
import type { AnnotatedSentence } from "../../types";
import type { ExtractedHeading } from "./heading-extraction";

/**
 * Horizontal rule with position info.
 */
export type HorizontalRuleInfo = {
	sentence: AnnotatedSentence;
	originalIndex: number;
};

/**
 * Element that can be inserted: either a heading or a horizontal rule.
 */
export type InsertableElement = {
	kind: "heading" | "hr";
	text: string;
	originalOffset: number; // Where it ends in original text (for headings) or where it is (for HRs)
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
 * Find all headings and HRs that precede a given offset and haven't been used yet.
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
 * Context for building block text with headings.
 */
export type HeadingInsertionContext = {
	headings: ExtractedHeading[];
	horizontalRules: HorizontalRuleInfo[];
	offsetMap: (filtered: number) => number;
	protectedToFiltered: (prot: number) => number;
	protectedItems: ProtectedContent[];
};

/**
 * Build block text with headings and HRs inserted before their corresponding sentences.
 * This handles the case where multiple elements should appear within a single block,
 * and also captures "orphaned" headings/HRs whose original content was filtered out.
 */
export function buildBlockTextWithHeadings(
	sentences: AnnotatedSentence[],
	context: HeadingInsertionContext | undefined,
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
