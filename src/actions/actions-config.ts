import { z } from 'zod';
import newGenCommand from './new/new-gen-command';
import updateActionsBlock from './new/update-actions-block';
import { Action, ActionPlacement } from 'types/beta/system/actions';
import newTranslateSelection from './new/translateSelection';
import TextEaterPlugin from 'main';

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
		label: 'Sort Contexts',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.SplitInBlocks]: {
		execute: newGenCommand,
		label: 'Split',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.TranslateBlock]: {
		execute: newGenCommand,
		label: 'Translate',
		placement: ActionPlacement.ShortcutOnly,
	},
	[Action.TranslateSelection]: {
		execute: newTranslateSelection,
		label: 'Translate',
		placement: ActionPlacement.AboveSelection,
	},
} satisfies Record<
	Action,
	{
		execute: (plugin: TextEaterPlugin) => void;
		label: string;
		placement: ActionPlacement;
	}
>;
