import { makeSplitPath } from "../managers/obsidian/vault-action-manager";
import {
	type SplitPathToFolder,
	SplitPathType,
} from "../managers/obsidian/vault-action-manager/types/split-path";
import type { TextEaterSettings } from "../types";
import type { Prettify } from "../types/helpers";

export type ParsedUserSettings = Prettify<
	Omit<TextEaterSettings, "libraryRoot"> & {
		splitPathToLibraryRoot: SplitPathToFolder;
	}
>;

export function parseSettings(settings: TextEaterSettings): ParsedUserSettings {
	const splitPathResult = makeSplitPath(settings.libraryRoot);
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
