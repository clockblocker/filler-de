import z from 'zod';
import newGenCommand from './new/new-gen-command';
import updateActionsBlock from './new/update-actions-block';

export const ACTION_NAME_LITERALS = [
	'Generate',
	'UpdateActionsBlock',

	// 'AddContext',
	// 'SplitContexts',
	// 'SplitInBlocks',
	// 'TranslateSelection',
	// 'TranslateBlock',
	// 'ExplainGrammar',
] as const;

export const ActionNameSchema = z.enum(ACTION_NAME_LITERALS);

export type ActionName = z.infer<typeof ActionNameSchema>;
export const ActionName = ActionNameSchema.enum;
export const ActionNames = ActionNameSchema.options;

export const ACTION_BY_NAME = {
	[ActionName.Generate]: newGenCommand,
	[ActionName.UpdateActionsBlock]: updateActionsBlock,
	// [Action.AddContext]: newGenCommand,
	// [Action.ExplainGrammar]: newGenCommand,
	// [Action.SplitContexts]: newGenCommand,
	// [Action.SplitInBlocks]: newGenCommand,
	// [Action.TranslateBlock]: newGenCommand,
	// [Action.TranslateSelection]: newGenCommand,
} satisfies Record<ActionName, unknown>;
