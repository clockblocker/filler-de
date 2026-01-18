/**
 * Suffix delimiter configuration.
 * Symbol: 1-3 non-space chars (e.g., "-", "~")
 * Padded: wrap symbol in spaces (" - " vs "-")
 */
export type SuffixDelimiterConfig = {
	symbol: string; // 1-3 non-space chars
	padded: boolean; // wrap in spaces: " - " vs "-"
};

export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: SuffixDelimiterConfig;
	maxSectionDepth: number; // 0 = own children only, 1 = own children and their children, etc.
	showScrollsInCodexesForDepth: number;
	showScrollBacklinks: boolean;
	hideMetadata: boolean; // Store metadata invisibly at end of file. When false, uses YAML frontmatter.
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
	hideMetadata: true,
	libraryRoot: "Library",
	maxSectionDepth: 6,
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	suffixDelimiter: { padded: false, symbol: "-" },
};
