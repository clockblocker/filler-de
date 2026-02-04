/**
 * Offset Mapper Helper
 *
 * Provides reusable utilities for mapping character offsets between
 * different text transformations (removal, placeholder replacement).
 */

/**
 * Item that was removed from text.
 */
export type RemovedItem = {
	/** Character position where item started in original text */
	startOffset: number;
	/** Character position where item ended in original text */
	endOffset: number;
};

/**
 * Item that was replaced with a placeholder.
 */
export type ReplacedItem = {
	/** The placeholder string that replaced the original */
	placeholder: string;
	/** The original content that was replaced */
	original: string;
	/** Character position in text where original content started */
	startOffset: number;
};

/**
 * Creates a mapping function from filtered-text offsets to original-text offsets.
 * Used after removing content (e.g., headings) to map positions back.
 *
 * @param removedItems - Items that were removed from the text
 * @returns Function that maps filtered offset to original offset
 */
function createRemovalMap(
	removedItems: RemovedItem[],
): (filteredOffset: number) => number {
	if (removedItems.length === 0) {
		return (offset) => offset;
	}

	// Sort by original start offset
	const sorted = [...removedItems].sort(
		(a, b) => a.startOffset - b.startOffset,
	);

	// Calculate cumulative removed length at each item
	type Removal = {
		originalStart: number;
		removedLength: number;
		cumulative: number;
	};
	const removals: Removal[] = [];
	let cumulative = 0;

	for (const item of sorted) {
		const len = item.endOffset - item.startOffset;
		removals.push({
			cumulative,
			originalStart: item.startOffset,
			removedLength: len,
		});
		cumulative += len;
	}

	return (filteredOffset: number) => {
		// Find how much has been removed before this filtered offset
		let totalRemoved = 0;
		for (const r of removals) {
			// If the filtered offset (+ what we've already removed) is past this removal point
			if (filteredOffset + totalRemoved >= r.originalStart) {
				totalRemoved = r.cumulative + r.removedLength;
			} else {
				break;
			}
		}
		return filteredOffset + totalRemoved;
	};
}

/**
 * Creates a mapping function from protected-text offsets to filtered-text offsets.
 * Used after replacing content with placeholders to map positions back.
 *
 * This is needed because:
 * - Sentences have sourceOffset relative to protected text (with placeholders)
 * - The removal offset map expects offsets relative to filtered text (before protection)
 * - Placeholders are shorter/longer than original content, shifting positions
 *
 * Example: URL "https://example.com" (19 chars) → placeholder "␜URL0␜" (6 chars)
 * If URL was at filtered offset 10, after protection:
 * - Placeholder is at protected offset 10
 * - Text after the URL shifts by (6 - 19) = -13 chars
 * - So protected offset 30 → filtered offset 30 + 13 = 43
 *
 * @param replacedItems - Items that were replaced with placeholders
 * @returns Function that maps protected-space offset to filtered-space offset
 */
function createReplacementMap(
	replacedItems: ReplacedItem[],
): (protectedOffset: number) => number {
	if (replacedItems.length === 0) {
		return (offset) => offset;
	}

	// Sort by startOffset (position in filtered text where original content was)
	const sorted = [...replacedItems].sort(
		(a, b) => a.startOffset - b.startOffset,
	);

	// Pre-calculate where each placeholder starts/ends in protected text
	// and the cumulative offset adjustment after each
	type Replacement = {
		protectedStart: number; // Where placeholder starts in protected text
		protectedEnd: number; // Where placeholder ends in protected text
		filteredStart: number; // Where original started in filtered text
		cumulativeAdjustment: number; // Total adjustment for positions AFTER this replacement
	};

	const replacements: Replacement[] = [];
	let cumulativeShift = 0; // Total (originalLen - placeholderLen) for all prior replacements

	for (const item of sorted) {
		const placeholderLen = item.placeholder.length;
		const originalLen = item.original.length;

		// In protected text, this placeholder starts at:
		// filteredStart minus the cumulative shrinkage from prior replacements
		// (placeholders are typically shorter than originals, so positions shift left)
		const protectedStart = item.startOffset - cumulativeShift;
		const protectedEnd = protectedStart + placeholderLen;

		// Update cumulative shift with this replacement's contribution
		const thisAdjustment = originalLen - placeholderLen;
		cumulativeShift += thisAdjustment;

		replacements.push({
			cumulativeAdjustment: cumulativeShift,
			filteredStart: item.startOffset,
			protectedEnd,
			protectedStart,
		});
	}

	return (protectedOffset: number) => {
		// Walk through replacements to find the right adjustment
		for (let i = replacements.length - 1; i >= 0; i--) {
			const r = replacements[i]!;

			if (protectedOffset >= r.protectedEnd) {
				// Position is after this replacement - apply cumulative adjustment
				return protectedOffset + r.cumulativeAdjustment;
			}

			if (protectedOffset >= r.protectedStart) {
				// Position is inside a placeholder - map to start of original content
				return r.filteredStart;
			}
		}

		// Position is before all replacements - no adjustment needed
		return protectedOffset;
	};
}

export const offsetMapperHelper = {
	createRemovalMap,
	createReplacementMap,
};
