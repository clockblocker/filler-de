import { makeTextAction } from "./new/make-text-action";
import { navigatePageAction } from "./new/navigate-pages-action";
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
		execute: newGenCommand,
		id: UserAction.Generate,
		label: "Generate",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.AddContext]: {
		execute: newGenCommand,
		id: UserAction.AddContext,
		label: "Add Context",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.ExplainGrammar]: {
		execute: newGenCommand,
		id: UserAction.ExplainGrammar,
		label: "Explain Grammar",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitContexts]: {
		execute: newGenCommand,
		id: UserAction.SplitContexts,
		label: "Sort Contexts",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitInBlocks]: {
		execute: newSplitCommand,
		id: UserAction.SplitInBlocks,
		label: "Split",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.SplitToPages]: {
		execute: () => {
			// Command-only action, executed via main.ts command registration
			// This stub exists to satisfy the type requirement
		},
		id: UserAction.SplitToPages,
		label: "Split to Pages",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateBlock]: {
		execute: newGenCommand,
		id: UserAction.TranslateBlock,
		label: "Translate",
		placement: UserActionPlacement.ShortcutOnly,
	},
	[UserAction.TranslateSelection]: {
		execute: newTranslateSelection,
		id: UserAction.TranslateSelection,
		label: "Translate",
		placement: UserActionPlacement.AboveSelection,
	},
	[UserAction.MakeText]: {
		execute: makeTextAction,
		id: UserAction.MakeText,
		label: "Make this a text",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.NavigatePage]: {
		execute: (services) => navigatePageAction(services, "next"),
		id: UserAction.NavigatePage,
		label: "→",
		placement: UserActionPlacement.Bottom,
	},
	[UserAction.PreviousPage]: {
		execute: (services) => navigatePageAction(services, "prev"),
		id: UserAction.PreviousPage,
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

export const NAVIGATE_PAGE_ACTIONS: UserAction[] = [
	UserAction.PreviousPage,
	UserAction.NavigatePage,
] as const;

export const CHANGE_FILE_TYPE_ACTIONS: UserAction[] = [
	UserAction.MakeText,
] as const;

export const OPTIONAL_BOTTOM_ACTIONS = [
	...NAVIGATE_PAGE_ACTIONS,
	...CHANGE_FILE_TYPE_ACTIONS,
];
