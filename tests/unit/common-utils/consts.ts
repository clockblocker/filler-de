import { SplitPathKind } from "@textfresser/vault-action-manager";
import type { ParsedUserSettings } from "../../../src/global-state/parsed-settings";
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
	explainGrammarPlacement: "AboveSelection",
	generateInflections: true,
	generatePlacement: "Bottom",
	googleApiKey: "",
	hideMetadata: true,
	languages: { known: "English", target: "German" },
	maxSectionDepth: 6,
	navButtonsPosition: "left",
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	splitInBlocksPlacement: "AboveSelection",
	splitPathToLibraryRoot: {
		basename: "Library",
		kind: SplitPathKind.Folder,
		pathParts: [],
	},
	suffixDelimiter: buildCanonicalDelimiter(defaultDelimiterConfig),
	suffixDelimiterConfig: defaultDelimiterConfig,
	suffixDelimiterPattern: buildFlexibleDelimiterPattern(defaultDelimiterConfig),
	translatePlacement: "AboveSelection",
};
