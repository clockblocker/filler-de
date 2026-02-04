/**
 * Token Filter
 *
 * Stream-stage filtering utilities for content tokens.
 * Handles HR placeholder filtering and orphaned marker merging.
 */

import type { ContentToken } from "../../types";
import {
	isHorizontalRule,
	isOrphanedMarker,
} from "../block-marker/text-patterns";
import type { HRInfo } from "../page-formatter/types";

/**
 * Filters out HR placeholder tokens from annotated tokens.
 * Returns filtered tokens and tracked HR info for later reinsertion.
 */
export function filterHRPlaceholders(tokens: ContentToken[]): {
	filteredTokens: ContentToken[];
	hrInfos: HRInfo[];
} {
	const hrInfos: HRInfo[] = [];
	let sentenceIndex = 0;

	const filteredTokens = tokens.filter((token) => {
		if (token.kind !== "sentence") {
			return true; // Keep paragraph breaks
		}

		const trimmed = token.sentence.text.trim();

		// Check if this is an HR placeholder
		if (isHorizontalRule(trimmed)) {
			hrInfos.push({
				originalIndex: sentenceIndex,
				sentence: token.sentence,
			});
			sentenceIndex++;
			return false; // Filter out HR
		}

		sentenceIndex++;
		return true;
	});

	return { filteredTokens, hrInfos };
}

/**
 * Merges orphaned decoration markers (lone *, **, etc.) with the previous sentence.
 * Works on ContentToken array to preserve paragraph breaks.
 */
export function mergeOrphanedMarkersInTokens(
	tokens: ContentToken[],
): ContentToken[] {
	const result: ContentToken[] = [];

	for (const token of tokens) {
		if (token.kind === "paragraphBreak") {
			result.push(token);
			continue;
		}

		// Check if this sentence is an orphaned marker
		if (isOrphanedMarker(token.sentence.text.trim())) {
			// Try to merge with previous sentence (skip paragraph breaks when looking)
			for (let i = result.length - 1; i >= 0; i--) {
				const prev = result[i];
				if (prev?.kind === "sentence") {
					// Merge orphan into previous sentence
					result[i] = {
						kind: "sentence",
						sentence: {
							...prev.sentence,
							charCount:
								prev.sentence.charCount +
								token.sentence.charCount,
							text: prev.sentence.text + token.sentence.text,
						},
					};
					break;
				}
				// If we hit a paragraph break, stop looking (don't merge across paragraphs)
				if (prev?.kind === "paragraphBreak") {
					break;
				}
			}
			// Drop orphan at start or after paragraph break (edge case)
			continue;
		}

		result.push(token);
	}

	return result;
}
