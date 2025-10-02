import newGenCommand from './new/new-gen-command';
import { UserAction, UserActionPlacement } from 'types/beta/system/actions';
import newTranslateSelection from './new/translateSelection';
import newSplitCommand from './new/new-split-command';
import { TexfresserObsidianServices } from '../obsidian-services/interface';

export const ACTION_CONFIGS = {
	[UserAction.Generate]: {
		execute: newGenCommand,
		label: 'Generate',
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.AddContext]: {
		execute: newGenCommand,
		label: 'Add Context',
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.ExplainGrammar]: {
		execute: newGenCommand,
		label: 'Explain Grammar',
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitContexts]: {
		execute: newGenCommand,
		label: 'Sort Contexts',
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitInBlocks]: {
		execute: newSplitCommand,
		label: 'Split',
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateBlock]: {
		execute: newGenCommand,
		label: 'Translate',
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateSelection]: {
		execute: newTranslateSelection,
		label: 'Translate',
		placement: UserActionPlacement.AboveSelection,
	},
} satisfies Record<
	UserAction,
	{
		execute: (services: Partial<TexfresserObsidianServices>) => void;
		label: string;
		placement: UserActionPlacement;
	}
>;
