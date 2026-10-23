/**
 * Types for overlay action definitions.
 *
 * OverlayActionKind is the subset of CommandKind that can appear in overlays.
 */

import { z } from "zod";
import type { TextEaterSettings } from "../../../types";
import type { CommandKind } from "../../obsidian/command-executor";

// Subset of CommandKind that can appear in overlay UI
const OVERLAY_ACTION_KINDS = [
	"TranslateSelection",
	"SplitInBlocks",
	"Classify",
	"GoToPrevPage",
	"GoToNextPage",
] as const satisfies readonly (keyof typeof CommandKind)[];

const OverlayActionKindSchema = z.enum(OVERLAY_ACTION_KINDS);
export type OverlayActionKind = z.infer<typeof OverlayActionKindSchema>;
export const OverlayActionKind = OverlayActionKindSchema.enum;

/** Whether `id`, such as a clicked element's action id, names an overlay action. */
export const isOverlayActionKind = (id: string): id is OverlayActionKind =>
	OverlayActionKindSchema.safeParse(id).success;

const OVERLAY_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

const OverlayPlacementSchema = z.enum(OVERLAY_PLACEMENT_LITERALS);
export type OverlayPlacement = z.infer<typeof OverlayPlacementSchema>;
export const OverlayPlacement = OverlayPlacementSchema.enum;

/** The settings that place a toolbar action. */
export type PlacementSettingKey = keyof Pick<
	TextEaterSettings,
	| "translatePlacement"
	| "splitInBlocksPlacement"
	| "explainGrammarPlacement"
	| "generatePlacement"
>;

export type ActionDefinition = {
	id: OverlayActionKind;
	label: string;
	settingKey: PlacementSettingKey | null;
	requiresSelection: boolean;
	selectablePlacements: readonly OverlayPlacement[];
};
