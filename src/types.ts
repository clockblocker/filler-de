export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: string;
	maxSectionDepth: number; // 0 = own children only, 1 = own children and their children, etc.
	showScrollsInCodexesForDepth: number;
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
	libraryRoot: "Library",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
	suffixDelimiter: "-",
};
