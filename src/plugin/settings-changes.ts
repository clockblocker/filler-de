import type { TextEaterSettings } from "../types";

/** What a settings save changed, as far as the plugin acts on it. */
export type SettingsChanges = {
	readonly delimiter: boolean;
	readonly hideMetadata: boolean;
	readonly languages: boolean;
	/** The Librarian must restart under the new settings. */
	readonly librarian: boolean;
	/** The toolbars' button placements. */
	readonly placement: boolean;
};

export function diffSettings(
	prev: TextEaterSettings,
	curr: TextEaterSettings,
): SettingsChanges {
	const delimiter =
		prev.suffixDelimiter.symbol !== curr.suffixDelimiter.symbol ||
		prev.suffixDelimiter.padded !== curr.suffixDelimiter.padded;
	const hideMetadata = prev.hideMetadata !== curr.hideMetadata;
	const languages =
		prev.languages.known !== curr.languages.known ||
		prev.languages.target !== curr.languages.target;
	const librarian =
		delimiter ||
		hideMetadata ||
		languages ||
		prev.maxSectionDepth !== curr.maxSectionDepth ||
		prev.showScrollsInCodexesForDepth !==
			curr.showScrollsInCodexesForDepth ||
		prev.libraryRoot !== curr.libraryRoot ||
		prev.showScrollBacklinks !== curr.showScrollBacklinks;
	const placement =
		prev.translatePlacement !== curr.translatePlacement ||
		prev.splitInBlocksPlacement !== curr.splitInBlocksPlacement ||
		prev.explainGrammarPlacement !== curr.explainGrammarPlacement ||
		prev.generatePlacement !== curr.generatePlacement;
	return { delimiter, hideMetadata, languages, librarian, placement };
}

/** A copy of `settings` to compare the next save against. */
export function snapshotSettings(
	settings: TextEaterSettings,
): TextEaterSettings {
	return { ...settings, suffixDelimiter: { ...settings.suffixDelimiter } };
}
