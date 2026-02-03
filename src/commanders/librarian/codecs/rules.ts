import type { ParsedUserSettings } from "../../../global-state/parsed-settings";
import type { LanguagesConfig, SuffixDelimiterConfig } from "../../../types";

/**
 * Codec configuration rules.
 * Keeps codecs pure by injecting rules instead of reaching for user settings internally.
 */
export type CodecRules = {
	/** Suffix delimiter config (symbol + padding) */
	suffixDelimiterConfig: SuffixDelimiterConfig;
	/** Suffix delimiter canonical form (e.g., "-" or " - ") */
	suffixDelimiter: string;
	/** Suffix delimiter flexible pattern for parsing */
	suffixDelimiterPattern: RegExp;
	/** Library root name (from splitPathToLibraryRoot.basename) */
	libraryRootName: string;
	/** Full library root path parts (from splitPathToLibraryRoot.pathParts) */
	libraryRootPathParts: string[];
	/** Whether to add go-back links on scroll files */
	showScrollBacklinks: boolean;
	/** Store metadata invisibly at end of file. When false, uses YAML frontmatter. */
	hideMetadata: boolean;
	/** User's known and target languages */
	languages: LanguagesConfig;
};

/**
 * Creates codec rules from parsed user settings.
 * Extracts required naming conventions for codec operations.
 */
export function makeCodecRulesFromSettings(
	settings: ParsedUserSettings,
): CodecRules {
	return {
		hideMetadata: settings.hideMetadata,
		languages: settings.languages,
		libraryRootName: settings.splitPathToLibraryRoot.basename,
		libraryRootPathParts: settings.splitPathToLibraryRoot.pathParts,
		showScrollBacklinks: settings.showScrollBacklinks,
		suffixDelimiter: settings.suffixDelimiter,
		suffixDelimiterConfig: settings.suffixDelimiterConfig,
		suffixDelimiterPattern: settings.suffixDelimiterPattern,
	};
}
