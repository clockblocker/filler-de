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
	explainGrammarPlacement: "selection",
	googleApiKey: "",
	hideMetadata: true,
	maxSectionDepth: 6,
	navButtonsPosition: "left",
	propagationV2Enabled: false,
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	splitInBlocksPlacement: "selection",
	splitPathToLibraryRoot: {
		basename: "Library",
		kind: SplitPathKind.Folder,
		pathParts: [],
	},
	suffixDelimiter: buildCanonicalDelimiter(defaultDelimiterConfig),
	suffixDelimiterConfig: defaultDelimiterConfig,
	suffixDelimiterPattern: buildFlexibleDelimiterPattern(defaultDelimiterConfig),
	translatePlacement: "selection",
};
