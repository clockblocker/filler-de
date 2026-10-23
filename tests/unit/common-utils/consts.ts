import { SplitPathKind } from "@textfresser/vault-action-manager";
import type { ParsedUserSettings } from "../../../src/settings/parsed-settings";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../../../src/utils/delimiter";

const defaultDelimiterConfig = {
	padded: false,
	symbol: "-",
};

export const defaultSettingsForUnitTests: ParsedUserSettings = {
	explainGrammarPlacement: "AboveSelection",
	generatePlacement: "Bottom",
	hideMetadata: true,
	languages: { known: "English", target: "German" },
	maxSectionDepth: 6,
	navButtonsPosition: "left",
	openaiApiKey: "",
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
	typesafeApiKey: "",
};
