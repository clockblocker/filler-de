import type { ParsedUserSettings } from "../../../src/global-state/parsed-settings";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../../../src/utils/delimiter";

const defaultDelimiterConfig = {
	padded: false,
	symbol: "-",
};

export const defaultSettingsForUnitTests: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	hideMetadata: true,
	maxSectionDepth: 6,
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	splitPathToLibraryRoot: {
		basename: "Library",
		kind: SplitPathKind.Folder,
		pathParts: [],
	},
	suffixDelimiter: buildCanonicalDelimiter(defaultDelimiterConfig),
	suffixDelimiterConfig: defaultDelimiterConfig,
	suffixDelimiterPattern: buildFlexibleDelimiterPattern(defaultDelimiterConfig),
};