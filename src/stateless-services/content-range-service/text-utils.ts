/**
 * Pure text utility functions for content processing.
 */

import { LINE_BREAK } from "../../types/literals";

/**
 * Split content into first line and rest.
 */
export function splitFirstLine(content: string): {
	firstLine: string;
	rest: string;
} {
	const newlineIndex = content.indexOf(LINE_BREAK);
	if (newlineIndex === -1) {
		return { firstLine: content, rest: "" };
	}
	return {
		firstLine: content.slice(0, newlineIndex),
		rest: content.slice(newlineIndex + 1),
	};
}

/**
 * Split content into YAML frontmatter and rest.
 * Frontmatter is enclosed by --- at start and end.
 * Returns null for frontmatter if none present.
 */
export function splitFrontmatter(content: string): {
	frontmatter: string | null;
	rest: string;
} {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		return { frontmatter: null, rest: content };
	}

	// Find the closing ---
	const startOffset = content.length - trimmed.length;
	const afterOpening = content.indexOf(LINE_BREAK, startOffset);
	if (afterOpening === -1) {
		return { frontmatter: null, rest: content };
	}

	const closingIndex = content.indexOf(`${LINE_BREAK}---`, afterOpening);
	if (closingIndex === -1) {
		return { frontmatter: null, rest: content };
	}

	// Find end of closing --- line
	const endOfClosing = content.indexOf(LINE_BREAK, closingIndex + 1);
	const frontmatterEnd =
		endOfClosing === -1 ? content.length : endOfClosing + 1;

	return {
		frontmatter: content.slice(0, frontmatterEnd),
		rest: content.slice(frontmatterEnd),
	};
}
