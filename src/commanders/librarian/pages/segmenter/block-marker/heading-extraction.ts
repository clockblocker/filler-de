/**
 * Heading Extraction
 *
 * Extracts headings from scanned lines and filters them from text.
 */

import type { RemovedItem } from "../../../../../stateless-helpers/offset-mapper";
import type { ScannedLine } from "../../types";

/**
 * A heading extracted from content with its position info.
 */
export type ExtractedHeading = {
	/** The heading text (e.g., "###### **ANNA:**") */
	text: string;
	/** Character offset in original content where heading starts */
	startOffset: number;
	/** Character offset where heading ends (including newline) */
	endOffset: number;
	/** Line number (0-indexed) */
	lineNumber: number;
};

/**
 * Extract headings from scanned lines.
 * Returns headings with their original character offsets.
 */
export function extractHeadings(lines: ScannedLine[]): ExtractedHeading[] {
	const headings: ExtractedHeading[] = [];
	let currentOffset = 0;

	for (const line of lines) {
		const lineLength = line.text.length;
		const endOffset = currentOffset + lineLength;

		if (line.isHeading) {
			headings.push({
				endOffset: endOffset + 1, // +1 for newline
				lineNumber: line.lineNumber,
				startOffset: currentOffset,
				text: line.text,
			});
		}

		// Move to next line (+1 for newline, except last line)
		currentOffset = endOffset + 1;
	}

	return headings;
}

/**
 * What removing each heading takes out of `text`: its line, but not the
 * line break that ends it. That break stays behind and, with the break
 * before the heading, makes a blank line, so the sentence splitter never
 * joins the text around a heading into one Sentence. Feed these to the
 * offset mapper to map filtered offsets back to `text`.
 */
export function headingRemovals(
	text: string,
	headings: readonly ExtractedHeading[],
): RemovedItem[] {
	return headings.map(({ endOffset, startOffset }) => ({
		endOffset: text[endOffset - 1] === "\n" ? endOffset - 1 : text.length,
		startOffset,
	}));
}

/**
 * Remove heading lines from text, leaving each heading's line break, so a
 * heading is always a paragraph boundary (see `headingRemovals`).
 */
export function filterHeadingsFromText(
	originalText: string,
	headings: ExtractedHeading[],
): string {
	if (headings.length === 0) return originalText;

	let result = originalText;
	// Process in reverse order to maintain offset validity
	const removals = headingRemovals(originalText, headings).sort(
		(a, b) => b.startOffset - a.startOffset,
	);

	for (const { endOffset, startOffset } of removals) {
		result = result.slice(0, startOffset) + result.slice(endOffset);
	}

	return result;
}
