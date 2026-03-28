/**
 * Page Accumulator
 *
 * Accumulates sentence groups into pages respecting size limits,
 * with support for heading and HR reinsertion.
 */

import type {
	PageSegment,
	SegmentationConfig,
	SentenceGroup,
} from "../../types";
import type { ExtractedHeading } from "../block-marker/heading-extraction";
import type { ProtectedContent } from "../stream/markdown-protector";
import {
	groupsToContentWithHeadingsAndHRs,
	groupsToContentWithHRs,
} from "./content-builder";
import type { HRInfo } from "./types";

/**
 * Checks if we should break the page after adding a group.
 */
export function shouldBreakPage(
	currentSize: number,
	nextGroup: SentenceGroup | undefined,
	config: SegmentationConfig,
): boolean {
	if (!nextGroup) return false;
	if (currentSize < config.targetPageSizeChars) return false;

	if (currentSize >= config.targetPageSizeChars) {
		if (!nextGroup.isSplittable) {
			const wouldBe = currentSize + nextGroup.charCount;
			if (wouldBe <= config.maxPageSizeChars * 1.5) {
				return false;
			}
		}
		return true;
	}

	if (currentSize >= config.maxPageSizeChars) {
		return true;
	}

	return false;
}

/**
 * Page accumulator with heading and HR reinsertion.
 */
export function accumulatePagesWithHeadingsAndHRs(
	groups: SentenceGroup[],
	config: SegmentationConfig,
	headings: ExtractedHeading[],
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;
	const usedHeadings = new Set<number>();
	const usedHRs = new Set<number>();

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContentWithHeadingsAndHRs(
				currentPageGroups,
				headings,
				hrInfos,
				offsetMap,
				protectedToFiltered,
				protectedItems,
				usedHeadings,
				usedHRs,
			);
			pages.push({
				charCount: content.length,
				content,
				pageIndex: pages.length,
			});
			currentPageGroups = [];
			currentPageSize = 0;
		}
	}

	if (currentPageGroups.length > 0) {
		const content = groupsToContentWithHeadingsAndHRs(
			currentPageGroups,
			headings,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			protectedItems,
			usedHeadings,
			usedHRs,
		);
		pages.push({
			charCount: content.length,
			content,
			pageIndex: pages.length,
		});
	}

	return pages;
}

/**
 * Page accumulator with HR reinsertion (no headings).
 */
export function accumulatePagesWithHRs(
	groups: SentenceGroup[],
	config: SegmentationConfig,
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	protectedItems: ProtectedContent[],
): PageSegment[] {
	if (groups.length === 0) return [];

	const pages: PageSegment[] = [];
	let currentPageGroups: SentenceGroup[] = [];
	let currentPageSize = 0;
	const usedHRs = new Set<number>();

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		if (!group) continue;

		currentPageGroups.push(group);
		currentPageSize += group.charCount;

		const nextGroup = groups[i + 1];
		if (shouldBreakPage(currentPageSize, nextGroup, config)) {
			const content = groupsToContentWithHRs(
				currentPageGroups,
				hrInfos,
				offsetMap,
				protectedToFiltered,
				protectedItems,
				usedHRs,
			);
			pages.push({
				charCount: content.length,
				content,
				pageIndex: pages.length,
			});
			currentPageGroups = [];
			currentPageSize = 0;
		}
	}

	if (currentPageGroups.length > 0) {
		const content = groupsToContentWithHRs(
			currentPageGroups,
			hrInfos,
			offsetMap,
			protectedToFiltered,
			protectedItems,
			usedHRs,
		);
		pages.push({
			charCount: content.length,
			content,
			pageIndex: pages.length,
		});
	}

	return pages;
}

/**
 * Filters out pages with only whitespace and re-indexes remaining pages.
 */
export function filterEmptyPages(pages: PageSegment[]): PageSegment[] {
	const nonEmpty = pages.filter((p) => p.content.trim().length > 0);
	// Re-index to ensure consecutive page numbers
	return nonEmpty.map((p, i) => ({ ...p, pageIndex: i }));
}
