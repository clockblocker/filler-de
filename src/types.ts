export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	googleApiKey: "",
};
