/**
 * Text Patterns
 *
 * Text detection utilities and pattern constants for block marking.
 */

import type { AnnotatedSentence } from "../../types";

/**
 * Lone asterisks/underscores from italics/bold spanning sentences.
 * Pattern: `*`, `**`, `_`, `__`, `***`, `___`
 */
export const ORPHAN_MARKER_PATTERN = /^\s*[*_]{1,3}\s*$/;

/**
 * Horizontal rules: 3+ of `-`, `*`, or `_` on their own line.
 */
export const HORIZONTAL_RULE_PATTERN = /^\s*(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/;

/**
 * Placeholder for protected horizontal rules (from markdown-protector).
 * Pattern: ␜HR<n>␜ where ␜ is \uFFFC (Object Replacement Character)
 */
export const HR_PLACEHOLDER_PATTERN = /^\s*\uFFFCHR\d+\uFFFC\s*$/;

/**
 * Check if text is an orphaned markdown marker (lone asterisks/underscores).
 */
export function isOrphanedMarker(text: string): boolean {
	return ORPHAN_MARKER_PATTERN.test(text.trim());
}

/**
 * Check if text is a horizontal rule (real or protected placeholder).
 */
export function isHorizontalRule(text: string): boolean {
	const trimmed = text.trim();
	// Check both real HR and protected HR placeholder
	return (
		(trimmed.length >= 3 && HORIZONTAL_RULE_PATTERN.test(trimmed)) ||
		HR_PLACEHOLDER_PATTERN.test(trimmed)
	);
}

/**
 * Check if sentence is a short speech intro (ends with ":" and ≤threshold words).
 */
export function isShortSpeechIntro(
	sentence: AnnotatedSentence,
	threshold: number,
): boolean {
	const text = sentence.text.trim();
	return text.endsWith(":") && countWords(text) <= threshold;
}

/**
 * Count words in text.
 */
export function countWords(text: string): number {
	const trimmed = text.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}
