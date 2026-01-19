import type { SuffixDelimiterConfig } from "../types";

/**
 * Build canonical delimiter string from config.
 * @example { symbol: "-", padded: true } → " - "
 * @example { symbol: "-", padded: false } → "-"
 */
export function buildCanonicalDelimiter(config: SuffixDelimiterConfig): string {
	if (config.padded) {
		return ` ${config.symbol} `;
	}
	return config.symbol;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build flexible delimiter pattern that matches any spacing around symbol.
 * @example { symbol: "-", ... } → /\s*-\s*
 */
export function buildFlexibleDelimiterPattern(
	config: SuffixDelimiterConfig,
): RegExp {
	const escapedSymbol = escapeRegex(config.symbol);
	return new RegExp(`\\s*${escapedSymbol}\\s*`);
}

/**
 * Check if basename needs delimiter normalization.
 * Returns true if basename contains the symbol with wrong spacing.
 */
export function needsDelimiterNormalization(
	basename: string,
	config: SuffixDelimiterConfig,
): boolean {
	const canonical = buildCanonicalDelimiter(config);
	const pattern = buildFlexibleDelimiterPattern(config);

	// Find all matches of the pattern
	const matches = basename.match(new RegExp(pattern.source, "g"));
	if (!matches) return false;

	// Check if any match differs from canonical
	return matches.some((match) => match !== canonical);
}

/**
 * Normalize delimiter spacing in basename to canonical form.
 * @example normalizeDelimiter("foo - bar", { symbol: "-", paddingBefore: false, paddingAfter: false }) → "foo-bar"
 */
export function normalizeDelimiter(
	basename: string,
	config: SuffixDelimiterConfig,
): string {
	const canonical = buildCanonicalDelimiter(config);
	const pattern = buildFlexibleDelimiterPattern(config);
	return basename.replace(new RegExp(pattern.source, "g"), canonical);
}

/**
 * Migrate old string delimiter format to new config format.
 * Parses spacing from the string to determine padding.
 */
export function migrateStringDelimiter(
	oldDelimiter: string,
): SuffixDelimiterConfig {
	const trimmed = oldDelimiter.trim();
	if (trimmed.length === 0) {
		// Fallback to default
		return { padded: false, symbol: "-" };
	}

	// If there's spacing on either side, consider it padded
	const padded = oldDelimiter.startsWith(" ") || oldDelimiter.endsWith(" ");

	return {
		padded,
		symbol: trimmed,
	};
}

/**
 * Check if a value is a valid SuffixDelimiterConfig object.
 */
export function isSuffixDelimiterConfig(
	value: unknown,
): value is SuffixDelimiterConfig {
	return (
		typeof value === "object" &&
		value !== null &&
		"symbol" in value &&
		typeof (value as SuffixDelimiterConfig).symbol === "string" &&
		"padded" in value &&
		typeof (value as SuffixDelimiterConfig).padded === "boolean"
	);
}
