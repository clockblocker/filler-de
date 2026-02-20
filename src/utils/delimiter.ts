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
