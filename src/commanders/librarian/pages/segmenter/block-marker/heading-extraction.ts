/**
 * Heading Extraction
 *
 * Extracts headings from scanned lines and filters them from text.
 */

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
 * Remove heading lines from text, replacing them with blank lines to preserve structure.
 * This ensures paragraph boundary detection still works correctly.
 */
export function filterHeadingsFromText(
	originalText: string,
	headings: ExtractedHeading[],
): string {
	if (headings.length === 0) return originalText;

	let result = originalText;
	// Process in reverse order to maintain offset validity
	const sortedHeadings = [...headings].sort(
		(a, b) => b.startOffset - a.startOffset,
	);

	for (const heading of sortedHeadings) {
		// Replace heading with empty line (keep the newline)
		const before = result.slice(0, heading.startOffset);
		const after = result.slice(heading.endOffset);
		result = before + after;
	}

	return result;
}
