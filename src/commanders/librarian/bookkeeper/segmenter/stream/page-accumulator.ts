import { nonEmptyArrayResult } from "../../../../../types/utils";
import type {
	AnnotatedSentence,
	PageSegment,
	SegmentationConfig,
	SentenceGroup,
} from "../../types";

/**
 * Reconstructs text from sentence groups, preserving paragraph spacing.
 */
function groupsToContent(groups: SentenceGroup[]): string {
	const sentences = groups.flatMap((g) => g.sentences);
	if (sentences.length === 0) return "";

	const [first, ...rest] = sentences;
	if (!first) return ""; // TypeScript narrowing guard
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
 * Checks if we should break the page after adding a group.
 */
function shouldBreakPage(
	currentSize: number,
	nextGroup: SentenceGroup | undefined,
	config: SegmentationConfig,
): boolean {
	// No next group - don't break yet
	if (!nextGroup) return false;

	// Under target - keep accumulating
	if (currentSize < config.targetPageSizeChars) return false;

	// At target or above - break if next group is splittable
	// (i.e., don't break before non-splittable content like poems)
	if (currentSize >= config.targetPageSizeChars) {
		// If next group is non-splittable (poem, multiline quote),
		// check if we'd go way over max by including it
		if (!nextGroup.isSplittable) {
			const wouldBe = currentSize + nextGroup.charCount;
			// Allow reasonable overflow for poems (1.5x max)
			if (wouldBe <= config.maxPageSizeChars * 1.5) {
				return false; // Keep poem with preceding content
			}
		}
		return true;
	}

	// Over max - force break
	if (currentSize >= config.maxPageSizeChars) {
		return true;
	}

	return false;
}

/**
 * Stage 5: Page Accumulator
 * Accumulates sentence groups into pages respecting size limits.
 */
export function accumulatePages(
	groups: SentenceGroup[],
	config: SegmentationConfig,
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		// Add group to current page
		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		// Check if we should break
		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			pages.push(createPage(currentPageGroups, pages.length));
			currentPageGroups = [];
			currentPageSize = 0;
		}
	}

	// Don't forget remaining content
	if (currentPageGroups.length > 0) {
		pages.push(createPage(currentPageGroups, pages.length));
	}

	return pages;
}

/**
 * Creates a PageSegment from groups.
 */
function createPage(groups: SentenceGroup[], pageIndex: number): PageSegment {
	const content = groupsToContent(groups);
	return {
		charCount: content.length,
		content,
		pageIndex,
	};
}

/**
 * Splits a large group at sentence boundaries to fit target size.
 * Used when a single group exceeds the target.
 */
export function splitLargeGroup(
	group: SentenceGroup,
	targetSize: number,
): SentenceGroup[] {
	// Non-splittable groups stay together
	if (!group.isSplittable) return [group];

	// Already fits
	if (group.charCount <= targetSize) return [group];

	const subGroups: SentenceGroup[] = [];
	let currentSentences: AnnotatedSentence[] = [];
	let currentSize = 0;

	for (const sentence of group.sentences) {
		// If adding this sentence exceeds target and we have content, start new sub-group
		if (currentSize > 0 && currentSize + sentence.charCount > targetSize) {
			const nonEmpty = nonEmptyArrayResult(currentSentences);
			if (nonEmpty.isOk()) {
				subGroups.push({
					charCount: currentSize,
					isSplittable: true,
					sentences: nonEmpty.value,
				});
			}
			currentSentences = [];
			currentSize = 0;
		}

		currentSentences.push(sentence);
		currentSize += sentence.charCount;
	}

	// Don't forget remaining
	const nonEmpty = nonEmptyArrayResult(currentSentences);
	if (nonEmpty.isOk()) {
		subGroups.push({
			charCount: currentSize,
			isSplittable: true,
			sentences: nonEmpty.value,
		});
	}

	return subGroups.length > 0 ? subGroups : [group];
}

/**
 * Pre-processes groups by splitting any that are too large.
 */
export function preprocessLargeGroups(
	groups: SentenceGroup[],
	config: SegmentationConfig,
): SentenceGroup[] {
	const result: SentenceGroup[] = [];

	for (const group of groups) {
		if (
			group.charCount > config.targetPageSizeChars &&
			group.isSplittable
		) {
			result.push(...splitLargeGroup(group, config.targetPageSizeChars));
		} else {
			result.push(group);
		}
	}

	return result;
}
