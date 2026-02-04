/**
 * Go-back link utilities.
 * Consolidates all go-back link pattern building.
 *
 * Go-back link format: [[__<delim><suffix>|← DisplayName]]
 * Examples:
 *   - Default delimiter: [[__-L4-L3-L2-L1|← L4]]
 *   - Custom delimiter: [[__ ;; Struwwelpeter ;; Chapter1|← Struwwelpeter]]
 */

import { BACK_ARROW, LINE_BREAK, SPACE_F } from "../../types/literals";
import { logger } from "../../utils/logger";

/**
 * Build regex pattern for go-back links.
 * Uses the current user's delimiter configuration.
 *
 * @returns RegExp that matches go-back links at the start of content
 */
function buildPattern(): RegExp {
	// Match any single-line [[__...]] at start (permissive so second-run always strips first-run output).
	// Handles format variations (spacing, unicode, etc.) that could cause duplicate links.
	return /^\s*\[\[__[^\n\r]*?\]\]\s*/;
}

/**
 * Check if a line is a go-back link.
 * Matches any link starting with [[__ and containing the back arrow.
 */
function isMatch(line: string): boolean {
	const pattern = /^\[\[__[^\]]+\]\]/;
	return pattern.test(line.trim());
}

/**
 * Strip ALL go-back links from content start.
 * Returns content without any leading go-back links (and trims leading whitespace).
 * Handles edge case where multiple go-back links exist (e.g., from bugs or manual edits).
 */
function strip(content: string): string {
	const pattern = buildPattern();
	let result = content;
	// Keep stripping while there are go-back links at the start
	while (pattern.test(result)) {
		result = result.replace(pattern, "").trimStart();
	}
	return result;
}

/**
 * Build a go-back link wikilink string.
 * @param targetBasename - The basename of the target file (without .md)
 * @param displayName - The name to display after the arrow
 */
function build(targetBasename: string, displayName: string): string {
	return `[[${targetBasename}|${BACK_ARROW}${SPACE_F}${displayName}]]`;
}

/**
 * Upsert go-back link with defensive check.
 * Strips existing go-back links, logs warning if strip failed
 * (indicates regex mismatch that could cause duplicate links).
 */
function upsert({
	content,
	targetBasename,
	displayName,
}: {
	content: string;
	targetBasename: string;
	displayName: string;
}): string {
	const body = strip(content);

	// Defensive: check if strip left a go-back link (regex mismatch can cause duplicates)
	const firstNonEmptyLine = body
		.split("\n")
		.map((l) => l.trim())
		.find((l) => l.length > 0);

	if (firstNonEmptyLine && isMatch(firstNonEmptyLine)) {
		logger.warn(
			"[goBackLinkHelper.upsert] strip left a go-back link; regex may not match on-disk format",
			{ firstLine: firstNonEmptyLine.slice(0, 80) },
		);
	}

	const link = build(targetBasename, displayName);
	return `${LINE_BREAK}${SPACE_F}${link}${SPACE_F}${LINE_BREAK}${LINE_BREAK}${body}`;
}

/**
 * Go-back link helper object with grouped functions.
 */
export const goBackLinkHelper = {
	isMatch,
	strip,
	upsert,
};
