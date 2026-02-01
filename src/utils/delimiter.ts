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
