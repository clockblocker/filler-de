import z from 'zod';
import newGenCommand from './new/new-gen-command';
import updateActionsBlock from './new/update-actions-block';

export const ACTION_NAME_LITERALS = [
	'Generate',
	'UpdateActionsBlock',
	'AddContext',
	'SplitContexts',
	'SplitInBlocks',
	'TranslateSelection',
	'TranslateBlock',
	'ExplainGrammar',
] as const;

export const ActionNameSchema = z.enum(ACTION_NAME_LITERALS);

export type ActionName = z.infer<typeof ActionNameSchema>;
export const ActionName = ActionNameSchema.enum;
export const ActionNames = ActionNameSchema.options;

export const ACTION_BY_NAME = {
	[ActionName.Generate]: newGenCommand,
	[ActionName.UpdateActionsBlock]: updateActionsBlock,

	[ActionName.AddContext]: newGenCommand,
	[ActionName.ExplainGrammar]: newGenCommand,
	[ActionName.SplitContexts]: newGenCommand,
	[ActionName.SplitInBlocks]: newGenCommand,
	[ActionName.TranslateBlock]: newGenCommand,
	[ActionName.TranslateSelection]: newGenCommand,
} satisfies Record<ActionName, unknown>;
