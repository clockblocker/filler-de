import { makeTextAction } from "./new/make-text-action";
import { navigatePagesAction } from "./new/navigate-pages-action";
import newGenCommand from "./new/new-gen-command";
import newSplitCommand from "./new/new-split-command";
import newTranslateSelection from "./new/translateSelection";
import {
	type ActionConfig,
	ALL_USER_ACTIONS,
	UserAction,
	UserActionPlacement,
} from "./types";

export const ACTION_CONFIGS = {
	[UserAction.Generate]: {
		id: UserAction.Generate,
		execute: newGenCommand,
		label: "Generate",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.AddContext]: {
		id: UserAction.AddContext,
		execute: newGenCommand,
		label: "Add Context",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.ExplainGrammar]: {
		id: UserAction.ExplainGrammar,
		execute: newGenCommand,
		label: "Explain Grammar",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitContexts]: {
		id: UserAction.SplitContexts,
		execute: newGenCommand,
		label: "Sort Contexts",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitInBlocks]: {
		id: UserAction.SplitInBlocks,
		execute: newSplitCommand,
		label: "Split",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateBlock]: {
		id: UserAction.TranslateBlock,
		execute: newGenCommand,
		label: "Translate",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateSelection]: {
		id: UserAction.TranslateSelection,
		execute: newTranslateSelection,
		label: "Translate",
		placement: UserActionPlacement.AboveSelection,
	},
	[UserAction.MakeText]: {
		id: UserAction.MakeText,
		execute: makeTextAction,
		label: "Make this a text",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.NavigatePages]: {
		id: UserAction.NavigatePages,
		execute: (services) => navigatePagesAction(services, "next"),
		label: "→",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.PreviousPage]: {
		id: UserAction.PreviousPage,
		execute: (services) => navigatePagesAction(services, "prev"),
		label: "←",
		placement: UserActionPlacement.Bottom,
	},
} satisfies { [A in UserAction]: ActionConfig<A> };

export const getAllAboveSelectionActions = (): UserAction[] =>
	[...ALL_USER_ACTIONS].filter(
		(action) =>
			ACTION_CONFIGS[action].placement ===
			UserActionPlacement.AboveSelection,
	);

export const getAllBottomActions = (): UserAction[] =>
	[...ALL_USER_ACTIONS].filter(
		(action) =>
			ACTION_CONFIGS[action].placement === UserActionPlacement.Bottom,
	);

export const NAVIGATE_PAGES_ACTIONS: UserAction[] = [
	UserAction.PreviousPage,
	UserAction.NavigatePages,
] as const;

export const CHANGE_FILE_TYPE_ACTIONS: UserAction[] = [
	UserAction.MakeText,
] as const;

export const OPTIONAL_BOTTOM_ACTIONS = [
	...NAVIGATE_PAGES_ACTIONS,
	...CHANGE_FILE_TYPE_ACTIONS,
];
