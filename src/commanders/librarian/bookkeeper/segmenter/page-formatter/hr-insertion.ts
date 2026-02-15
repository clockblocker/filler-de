/**
 * HR Insertion
 *
 * Logic for finding and inserting horizontal rules at correct positions
 * during page content reconstruction.
 */

import {
	type ProtectedContent,
	restoreProtectedContent,
} from "../stream/markdown-protector";
import type { HRInfo } from "./types";

/**
 * Find HRs that precede a given sentence's original offset.
 */
export function findPrecedingHRs(
	sentenceOriginalOffset: number,
	hrInfos: HRInfo[],
	offsetMap: (n: number) => number,
	protectedToFiltered: (n: number) => number,
	usedHRs: Set<number>,
	protectedItems: ProtectedContent[],
): { text: string; originalOffset: number }[] {
	const result: { text: string; originalOffset: number }[] = [];

	for (let i = 0; i < hrInfos.length; i++) {
		if (usedHRs.has(i)) continue;
		const hr = hrInfos[i];
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
