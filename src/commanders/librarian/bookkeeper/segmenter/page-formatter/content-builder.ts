/**
 * Content Builder
 *
 * Reconstructs text from sentence groups, optionally inserting
 * headings and horizontal rules at appropriate positions.
 */

import type { SentenceGroup } from "../../types";
import type { ExtractedHeading } from "../block-marker/heading-extraction";
import { findPrecedingHeading } from "../block-marker/heading-insertion";
import type { ProtectedContent } from "../stream/markdown-protector";
import { findPrecedingHRs } from "./hr-insertion";
import type { HRInfo } from "./types";

/**
 * Reconstructs text from sentence groups, preserving paragraph spacing.
 */
export function groupsToContent(groups: SentenceGroup[]): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const [first, ...rest] = sentences;
	if (!first) return "";
	let result = first.text;
	for (const s of rest) {
		if (s.startsNewParagraph) {
			result += `\n\n${s.text.trimStart()}`;
		} else {
			result += s.text;
		}
	}
	return result;
}

/**
 * Reconstructs text from sentence groups with headings inserted.
 */
export function groupsToContentWithHeadings(
	groups: SentenceGroup[],
	headings: ExtractedHeading[],
	offsetMap: (n: number) => number,
	usedHeadings: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding heading
		const originalOffset = offsetMap(s.sourceOffset);
		const heading = findPrecedingHeading(
			originalOffset,
			headings,
			usedHeadings,
		);

		if (i === 0) {
			if (heading) {
				parts.push(`${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (heading) {
				parts.push(`\n\n${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (heading) {
				// Heading in middle of paragraph - add newline before heading
				parts.push(`\n${heading.text}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}

/**
 * Reconstructs text from sentence groups with headings and HRs inserted.
 */
export function groupsToContentWithHeadingsAndHRs(
	groups: SentenceGroup[],
	headings: ExtractedHeading[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
	usedHeadings: Set<number>,
	usedHRs: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding elements
		const originalOffset = offsetMap(s.sourceOffset);

		// Find preceding heading
		const heading = findPrecedingHeading(
			originalOffset,
			headings,
			usedHeadings,
		);

		// Find preceding HRs
		const precedingHRs = findPrecedingHRs(
			originalOffset,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			usedHRs,
			protectedItems,
		);

		// Build element prefix (heading and/or HRs)
		const elementParts: string[] = [];
		for (const hr of precedingHRs) {
			elementParts.push(hr.text);
		}
		if (heading) {
			elementParts.push(heading.text);
		}
		const elementsPrefix =
			elementParts.length > 0 ? elementParts.join("\n") : null;

		if (i === 0) {
			if (elementsPrefix) {
				parts.push(`${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (elementsPrefix) {
				parts.push(`\n\n${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (elementsPrefix) {
				// Element in middle of paragraph - add newline before
				parts.push(`\n${elementsPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}

/**
 * Reconstructs text from sentence groups with only HRs inserted (no headings).
 */
export function groupsToContentWithHRs(
	groups: SentenceGroup[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
	usedHRs: Set<number>,
): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const parts: string[] = [];

	for (let i = 0; i < sentences.length; i++) {
		const s = sentences[i];
		if (!s) continue;

		// Map filtered offset back to original to find preceding HRs
		const originalOffset = offsetMap(s.sourceOffset);

		// Find preceding HRs
		const precedingHRs = findPrecedingHRs(
			originalOffset,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			usedHRs,
			protectedItems,
		);

		const hrPrefix =
			precedingHRs.length > 0
				? precedingHRs.map((hr) => hr.text).join("\n")
				: null;

		if (i === 0) {
			if (hrPrefix) {
				parts.push(`${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		} else if (s.startsNewParagraph) {
			if (hrPrefix) {
				parts.push(`\n\n${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(`\n\n${s.text.trimStart()}`);
			}
		} else {
			if (hrPrefix) {
				parts.push(`\n${hrPrefix}\n${s.text.trimStart()}`);
			} else {
				parts.push(s.text);
			}
		}
	}

	return parts.join("");
}
