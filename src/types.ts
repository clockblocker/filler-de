export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: string;
	maxSectionDepth: number; // 0 = own children only, 1 = own children and their children, etc.
	showScrollsInCodexesForDepth: number;
	showScrollBacklinks: boolean;
	hideMetadata: boolean; // Store metadata invisibly at end of file. When false, uses YAML frontmatter.
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
	libraryRoot: "Library",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 1,
	suffixDelimiter: "-",
	showScrollBacklinks: true,
	hideMetadata: true,
};
