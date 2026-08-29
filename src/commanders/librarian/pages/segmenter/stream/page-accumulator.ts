import { nonEmptyArrayResult } from "../../../../../types/utils";
import type {
	AnnotatedSentence,
	SegmentationConfig,
	SentenceGroup,
} from "../../types";





/**
 * Splits a large group at sentence boundaries to fit target size.
 * Used when a single group exceeds the target.
 */
function splitLargeGroup(
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
