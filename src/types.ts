import { splitPath } from "./obsidian-vault-action-manager";
import type { SplitPathToFolder } from "./obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "./obsidian-vault-action-manager/types/split-path";
import type { Prettify } from "./types/helpers";

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

export type UserSettings = Prettify<
	Omit<TextEaterSettings, "libraryRoot"> & {
		splitPathToLibraryRoot: SplitPathToFolder;
	}
>;

export function parseSettings(settings: TextEaterSettings): UserSettings {
	const splitPathResult = splitPath(settings.libraryRoot);
	if (splitPathResult.type !== SplitPathType.Folder) {
		throw new Error(
			`Library root must be a folder, got: ${splitPathResult.type}`,
		);
	}

	const { libraryRoot: _, ...rest } = settings;
	return {
		...rest,
		splitPathToLibraryRoot: splitPathResult,
	};
}
