import { z } from "zod";

// ===== Language Configuration =====

export const LanguageSchema = z.enum(["Russian", "English", "German"]);
export type Language = z.infer<typeof LanguageSchema>;
export const Language = LanguageSchema.enum;

/** Display names for languages in settings UI */
export const ReprForLanguage: Record<Language, string> = {
	[Language.Russian]: "Русский",
	[Language.English]: "English",
	[Language.German]: "Deutsch",
};

export const KnownLanguageSchema = z.enum(["Russian", "English"]);
export type KnownLanguage = z.infer<typeof KnownLanguageSchema>;
export const KnownLanguage = KnownLanguageSchema.enum;
export const ALL_KNOWN_LANGUAGES = KnownLanguageSchema.options;

export const TargetLanguageSchema = z.enum(["English", "German"]);
export type TargetLanguage = z.infer<typeof TargetLanguageSchema>;
export const TargetLanguage = TargetLanguageSchema.enum;
export const ALL_TARGET_LANGUAGES = TargetLanguageSchema.options;

export type LanguagesConfig = {
	known: KnownLanguage;
	target: TargetLanguage;
};

/**
 * Suffix delimiter configuration.
 * Symbol: 1-3 non-space chars (e.g., "-", "~")
 * Padded: wrap symbol in spaces (" - " vs "-")
 */
export type SuffixDelimiterConfig = {
	symbol: string; // 1-3 non-space chars
	padded: boolean; // wrap in spaces: " - " vs "-"
};

/**
 * Where a selection action appears.
 * - "AboveSelection": toolbar above selection (default)
 * - "Bottom": in bottom toolbar
 * - "ShortcutOnly": no toolbar, keyboard shortcuts only
 */
const SELECTION_ACTION_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

export const SelectionActionPlacementSchema = z.enum(
	SELECTION_ACTION_PLACEMENT_LITERALS,
);
export type SelectionActionPlacement = z.infer<
	typeof SelectionActionPlacementSchema
>;
export const SelectionActionPlacement = SelectionActionPlacementSchema.enum;

/** Display text for selection action placement options in settings UI */
export const SELECTION_ACTION_PLACEMENT_TEXT: Record<
	SelectionActionPlacement,
	string
> = {
	AboveSelection: "Above selection",
	Bottom: "In bottom toolbar",
	ShortcutOnly: "Shortcut only",
};

export type TextEaterSettings = {
	googleApiKey: string;
	apiProvider: "google";
	libraryRoot: string;
	suffixDelimiter: SuffixDelimiterConfig;
	maxSectionDepth: number; // 0 = own children only, 1 = own children and their children, etc.
	showScrollsInCodexesForDepth: number;
	showScrollBacklinks: boolean;
	hideMetadata: boolean; // Store metadata invisibly at end of file. When false, uses YAML frontmatter.
	translatePlacement: SelectionActionPlacement;
	splitInBlocksPlacement: SelectionActionPlacement;
	explainGrammarPlacement: SelectionActionPlacement;
	generatePlacement: SelectionActionPlacement;
	navButtonsPosition: "left" | "right";
	languages: LanguagesConfig;
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	explainGrammarPlacement: "AboveSelection",
	generatePlacement: "Bottom",
	googleApiKey: "",
	hideMetadata: true,
	languages: { known: "Russian", target: "German" },
	libraryRoot: "Library",
	maxSectionDepth: 6,
	navButtonsPosition: "left",
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	splitInBlocksPlacement: "AboveSelection",
	suffixDelimiter: { padded: false, symbol: "-" },
	translatePlacement: "AboveSelection",
};
