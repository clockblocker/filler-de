import { z } from "zod";

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
 * - "selection": toolbar above selection (default)
 * - "bottom": in bottom toolbar
 * - "shortcut-only": no toolbar, keyboard shortcuts only
 */
const SELECTION_ACTION_PLACEMENT_LITERALS = [
	"selection",
	"bottom",
	"shortcut-only",
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
	selection: "Above selection",
	bottom: "In bottom toolbar",
	"shortcut-only": "Shortcut only",
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
};

export const DEFAULT_SETTINGS: TextEaterSettings = {
	apiProvider: "google",
	explainGrammarPlacement: "selection",
	googleApiKey: "",
	hideMetadata: true,
	libraryRoot: "Library",
	maxSectionDepth: 6,
	showScrollBacklinks: true,
	showScrollsInCodexesForDepth: 1,
	splitInBlocksPlacement: "selection",
	suffixDelimiter: { padded: false, symbol: "-" },
	translatePlacement: "selection",
};
