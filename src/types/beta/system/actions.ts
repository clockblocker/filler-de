import z from 'zod';

export const ACTION_LITERALS = [
	'Generate',
	'AddContext',
	'SplitContexts',
	'SplitInBlocks',
	'TranslateSelection',
	'TranslateBlock',
	'ExplainGrammar',
] as const;

export const ActionSchema = z.enum(ACTION_LITERALS);

export type Action = z.infer<typeof ActionSchema>;
export const Action = ActionSchema.enum;
export const ACTIONS = ActionSchema.options;

export const ACTION_PLACEMENT_LITERALS = [
	'AboveSelection',
	'Bottom',
	'ShortcutOnly',
] as const;

export const ActionPlacementSchema = z.enum(ACTION_PLACEMENT_LITERALS);

export type ActionPlacement = z.infer<typeof ActionPlacementSchema>;
export const ActionPlacement = ActionPlacementSchema.enum;
export const ACTION_PLACEMENTS = ActionPlacementSchema.options;
