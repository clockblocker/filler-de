/**
 * Text Patterns
 *
 * Text detection utilities and pattern constants for block marking.
 */

/**
 * Lone asterisks/underscores from italics/bold spanning sentences.
 * Pattern: `*`, `**`, `_`, `__`, `***`, `___`
 */
const ORPHAN_MARKER_PATTERN = /^\s*[*_]{1,3}\s*$/;

/**
 * Horizontal rules: 3+ of `-`, `*`, or `_` on their own line.
 */
const HORIZONTAL_RULE_PATTERN = /^\s*(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/;

/**
 * Placeholder for protected horizontal rules (from markdown-protector).
 * Pattern: ␜HR<n>␜ where ␜ is \uFFFC (Object Replacement Character)
 */
const HR_PLACEHOLDER_PATTERN = /^\s*\uFFFCHR\d+\uFFFC\s*$/;

/**
 * Placeholder for protected code blocks (from markdown-protector).
 * Pattern: ␜CB<n>␜ where ␜ is \uFFFC (Object Replacement Character)
 */
const CODE_BLOCK_PLACEHOLDER_PATTERN = /^\s*\uFFFCCB\d+\uFFFC\s*$/;

/**
 * Real fenced code block pattern.
 * Matches content that starts and ends with ``` (with optional language specifier).
 */
const FENCED_CODE_BLOCK_PATTERN = /^```[\s\S]*```$/;

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
 * Check if text is a code block (placeholder or real fenced code block).
 * - Placeholder: ␜CB<n>␜ (from markdown-protector)
 * - Real: content starting with ``` and ending with ```
 */
export function isCodeBlock(text: string): boolean {
	const trimmed = text.trim();
	return (
		CODE_BLOCK_PLACEHOLDER_PATTERN.test(trimmed) ||
		FENCED_CODE_BLOCK_PATTERN.test(trimmed)
	);
}
