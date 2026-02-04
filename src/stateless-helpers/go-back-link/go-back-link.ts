/**
 * Go-back link utilities.
 * Consolidates all go-back link pattern building and parsing.
 *
 * Go-back link format: [[__<delim><suffix>|← DisplayName]]
 * Examples:
 *   - Default delimiter: [[__-L4-L3-L2-L1|← L4]]
 *   - Custom delimiter: [[__ ;; Struwwelpeter ;; Chapter1|← Struwwelpeter]]
 */

import { PREFIX_OF_CODEX } from "../../commanders/librarian/types/consts/literals";
import { getParsedUserSettings } from "../../global-state/global-state";
import { BACK_ARROW, LINE_BREAK, SPACE_F } from "../../types/literals";
import type { GoBackLinkInfo } from "./types";

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
 * Build regex pattern for go-back links with capture groups.
 * Captures: (1) suffix, (2) display name
 */
function buildCapturePattern(): RegExp {
	// Capture groups: [[__(<suffix>)|←(<displayName>)]] with optional spaces around | and ←
	return /^\s*\[\[__([^\]|]+)\s*\|\s*←\s*([^\]]+)\]\]\s*/;
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
 * Parse a go-back link line.
 * Returns null if the line is not a valid go-back link.
 */
function parse(line: string): GoBackLinkInfo | null {
	const pattern = buildCapturePattern();
	const match = line.match(pattern);

	if (!match || !match[2] || !match[1]) {
		return null;
	}

	return {
		displayName: match[2].trim(),
		fullLink: match[0].trim(),
		suffix: match[1],
	};
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
 * Get the go-back link prefix used in basenames.
 * This is the "__" followed by the delimiter.
 */
function getPrefix(): string {
	const { suffixDelimiter } = getParsedUserSettings();
	return `${PREFIX_OF_CODEX}${suffixDelimiter}`;
}

/**
 * Add go-back link to content, stripping any existing go-back link.
 * Idempotent: calling multiple times produces the same result.
 * Format: \n[[link]]  \n\n<body>
 *
 * @param content - The note content (caller should strip metadata if needed)
 * @param targetBasename - Basename of the target file (without .md)
 * @param displayName - Name to display after the arrow
 * @returns Content with go-back link prepended
 */
function add({
	content,
	targetBasename,
	displayName,
}: {
	content: string;
	targetBasename: string;
	displayName: string;
}): string {
	const body = strip(content);
	const link = build(targetBasename, displayName);
	return `${LINE_BREAK}${SPACE_F}${SPACE_F}${link}${SPACE_F}${LINE_BREAK}${LINE_BREAK}${body}`;
}

/**
 * Go-back link helper object with grouped functions.
 */
export const goBackLinkHelper = {
	add,
	build,
	getPrefix,
	isMatch,
	parse,
	strip,
};
