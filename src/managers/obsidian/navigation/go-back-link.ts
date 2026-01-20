/**
 * Go-back link utilities.
 * Consolidates all go-back link pattern building and parsing.
 *
 * Go-back link format: [[__<delim><suffix>|← DisplayName]]
 * Examples:
 *   - Default delimiter: [[__-L4-L3-L2-L1|← L4]]
 *   - Custom delimiter: [[__ ;; Struwwelpeter ;; Chapter1|← Struwwelpeter]]
 */

import { getParsedUserSettings } from "../../../global-state/global-state";
import { BACK_ARROW } from "../../../types/literals";
import type { GoBackLinkInfo } from "./types";

/**
 * Build regex pattern for go-back links.
 * Uses the current user's delimiter configuration.
 *
 * @returns RegExp that matches go-back links at the start of content
 */
export function buildGoBackLinkPattern(): RegExp {
	// Go-back links always start with [[__
	// The suffix uses the user's delimiter pattern
	// Display name is after the pipe and arrow
	// Pattern: [[__<anything>|←<anything>]]
	return /^\s*\[\[__[^\]]+\|←[^\]]+\]\]\s*/;
}

/**
 * Build regex pattern for go-back links with capture groups.
 * Captures: (1) suffix, (2) display name
 */
export function buildGoBackLinkCapturePattern(): RegExp {
	// Capture groups: [[__(<suffix>)|←(<displayName>)]]
	return /^\s*\[\[__([^\]|]+)\|←\s*([^\]]+)\]\]\s*/;
}

/**
 * Check if a line is a go-back link.
 * Matches any link starting with [[__ and containing the back arrow.
 */
export function isGoBackLine(line: string): boolean {
	const pattern = /^\[\[__[^\]]+\]\]/;
	return pattern.test(line.trim());
}

/**
 * Strip go-back link from content start.
 * Returns content without the leading go-back link.
 */
export function stripGoBackLink(content: string): string {
	const pattern = buildGoBackLinkPattern();
	return content.replace(pattern, "");
}

/**
 * Parse a go-back link line.
 * Returns null if the line is not a valid go-back link.
 */
export function parseGoBackLink(line: string): GoBackLinkInfo | null {
	const pattern = buildGoBackLinkCapturePattern();
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
export function buildGoBackLink(
	targetBasename: string,
	displayName: string,
): string {
	return `[[${targetBasename}|${BACK_ARROW} ${displayName}]]`;
}

/**
 * Get the go-back link prefix used in basenames.
 * This is the "__" followed by the delimiter.
 */
export function getGoBackLinkPrefix(): string {
	const { suffixDelimiter } = getParsedUserSettings();
	return `__${suffixDelimiter}`;
}
