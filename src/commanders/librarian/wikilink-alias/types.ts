/**
 * Types for wikilink alias service.
 */

import type { Result } from "neverthrow";

/**
 * Parsed suffix result.
 */
export type ParsedSuffix = {
	coreName: string;
	suffixParts: string[];
};

/**
 * Interface for suffix parsing.
 * Allows injection of different suffix parsers.
 */
export type SuffixParser = {
	parseSeparatedSuffix: (
		text: string,
	) => Result<ParsedSuffix, { kind: string }>;
};

/**
 * Result of alias resolution.
 */
export type AliasResult = {
	alias: string;
} | null;
