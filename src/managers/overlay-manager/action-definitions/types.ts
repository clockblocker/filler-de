/**
 * Types for overlay action definitions.
 *
 * OverlayActionKind is the subset of CommandKind that can appear in overlays.
 */

import { z } from "zod";
import type { CommandKind } from "../../obsidian/command-executor";

// Subset of CommandKind that can appear in overlay UI
const OVERLAY_ACTION_KINDS = [
	"TranslateSelection",
	"SplitInBlocks",
	"Generate",
	"GoToPrevPage",
	"GoToNextPage",
] as const satisfies readonly (keyof typeof CommandKind)[];

export const OverlayActionKindSchema = z.enum(OVERLAY_ACTION_KINDS);
export type OverlayActionKind = z.infer<typeof OverlayActionKindSchema>;
export const OverlayActionKind = OverlayActionKindSchema.enum;

const OVERLAY_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

export const OverlayPlacementSchema = z.enum(OVERLAY_PLACEMENT_LITERALS);
export type OverlayPlacement = z.infer<typeof OverlayPlacementSchema>;
export const OverlayPlacement = OverlayPlacementSchema.enum;

export type ActionDefinition = {
	id: OverlayActionKind;
	label: string;
	settingKey: string | null;
	requiresSelection: boolean;
	selectablePlacements: readonly OverlayPlacement[];
};
