import { makeSplitPath } from "../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToFolder,
} from "../managers/obsidian/vault-action-manager/types/split-path";
import type { SuffixDelimiterConfig, TextEaterSettings } from "../types";
import type { Prettify } from "../types/helpers";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../utils/delimiter";

export type ParsedUserSettings = Prettify<
	Omit<TextEaterSettings, "libraryRoot" | "suffixDelimiter"> & {
		splitPathToLibraryRoot: SplitPathToFolder;
		suffixDelimiterConfig: SuffixDelimiterConfig;
		suffixDelimiter: string; // canonical form
		suffixDelimiterPattern: RegExp; // flexible pattern for parsing
	}
>;

export function parseSettings(settings: TextEaterSettings): ParsedUserSettings {
	const splitPathResult = makeSplitPath(settings.libraryRoot);
	if (splitPathResult.kind !== SplitPathKind.Folder) {
		throw new Error(
			`Library root must be a folder, got: ${splitPathResult.kind}`,
		);
	}

	const suffixDelimiterConfig = settings.suffixDelimiter;

	const { libraryRoot: _, suffixDelimiter: __, ...rest } = settings;

	return {
		...rest,
		splitPathToLibraryRoot: splitPathResult,
		suffixDelimiter: buildCanonicalDelimiter(suffixDelimiterConfig),
		suffixDelimiterConfig,
		suffixDelimiterPattern: buildFlexibleDelimiterPattern(
			suffixDelimiterConfig,
		),
	};
}
