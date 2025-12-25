export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: string;
	maxSectionDepth: number;
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
	libraryRoot: "Library",
	maxSectionDepth: 6,
	suffixDelimiter: "-",
};
