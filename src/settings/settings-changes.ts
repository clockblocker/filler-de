import type {
	LanguagesConfig,
	SuffixDelimiterConfig,
	TextEaterSettings,
} from "../types";

/**
 * A change to the settings. The languages and the delimiter merge into the
 * ones in effect as the change applies, so two quick changes of one field
 * each both land.
 */
export type SettingsPatch = Omit<
	Partial<TextEaterSettings>,
	"languages" | "suffixDelimiter"
> & {
	readonly languages?: Partial<LanguagesConfig>;
	readonly suffixDelimiter?: Partial<SuffixDelimiterConfig>;
};

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

/**
 * `settings` with `patch` over them, sharing no nested object with either.
 * A key the patch holds as undefined keeps its value.
 */
export function patchSettings(
	settings: TextEaterSettings,
	patch: SettingsPatch,
): TextEaterSettings {
	const given = Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	);
	return {
		...settings,
		...given,
		languages: { ...settings.languages, ...patch.languages },
		suffixDelimiter: {
			...settings.suffixDelimiter,
			...patch.suffixDelimiter,
		},
	};
}
