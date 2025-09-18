import z from 'zod';
import newGenCommand from './new/new-gen-command';
import updateActionsBlock from './new/update-actions-block';
import { Action, ActionPlacement } from 'types/beta/system/actions';
import newTranslateSelection from './new/translateSelection';

export const ACTION_CONFIGS = {
	[Action.Generate]: {
		execute: newGenCommand,
		label: 'Generate',
		placement: ActionPlacement.Bottom,
	},
	[Action.AddContext]: {
		execute: newGenCommand,
		label: 'Add Context',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.ExplainGrammar]: {
		execute: newGenCommand,
		label: 'Explain Grammar',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.SplitContexts]: {
		execute: newGenCommand,
		label: 'Split Contexts',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.SplitInBlocks]: {
		execute: newGenCommand,
		label: 'Generate',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.TranslateBlock]: {
		execute: newGenCommand,
		label: 'Generate',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.TranslateSelection]: {
		execute: newTranslateSelection,
		label: 'Generate',
		placement: ActionPlacement.AboveSelection,
	},
} satisfies Record<
	Action,
	{ execute: unknown; label: string; placement: ActionPlacement }
>;
