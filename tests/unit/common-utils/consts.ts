import type { ParsedUserSettings } from "../../../src/global-state/parsed-settings";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";

export const defaultSettingsForUnitTests: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 1,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathKind.Folder,
	},
	suffixDelimiter: "-",
};