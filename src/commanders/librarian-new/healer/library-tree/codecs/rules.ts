import type { ParsedUserSettings } from "../../../../../global-state/parsed-settings";

/**
 * Codec configuration rules.
 * Keeps codecs pure by injecting rules instead of reaching for user settings internally.
 */
export type CodecRules = {
	/** Suffix delimiter (e.g., "-") */
	suffixDelimiter: string;
	/** Library root name (from splitPathToLibraryRoot.basename) */
	libraryRootName: string;
};

/**
 * Creates codec rules from parsed user settings.
 * Extracts required naming conventions for codec operations.
 */
export function makeCodecRulesFromSettings(
	settings: ParsedUserSettings,
): CodecRules {
	return {
		suffixDelimiter: settings.suffixDelimiter,
		libraryRootName: settings.splitPathToLibraryRoot.basename,
	};
}
