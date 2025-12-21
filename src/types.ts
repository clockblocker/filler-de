export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: string;
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
	libraryRoot: "Library",
	suffixDelimiter: "-",
};

