/**
 * Types for overlay action definitions.
 */

import { z } from "zod";

const OVERLAY_ACTION_KIND_LITERALS = [
	"Translate",
	"SplitInBlocks",
	"ExplainGrammar",
	"Generate",
] as const;

export const OverlayActionKindSchema = z.enum(OVERLAY_ACTION_KIND_LITERALS);
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
	settingKey: string;
	requiresSelection: boolean;
};
