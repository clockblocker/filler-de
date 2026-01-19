import { FileType } from "../../../types/common-interface/enums";
import { makeTextAction } from "./new/make-text-action";
import { navigatePageAction } from "./new/navigate-pages-action";
import newGenCommand from "./new/new-gen-command";
import newSplitCommand from "./new/new-split-command";
import newTranslateSelection from "./new/translateSelection";
import {
	type ActionConfig,
	ALL_USER_ACTIONS,
	type ButtonContext,
	UserAction,
	UserActionPlacement,
} from "./types";

/**
 * Action configurations with visibility predicates.
 * Each action defines when it should be shown via isAvailable().
 * Priority determines button order (lower = higher priority).
 */
export const ACTION_CONFIGS = {
	[UserAction.Generate]: {
		execute: newGenCommand,
		id: UserAction.Generate,
		label: "Generate",
		placement: UserActionPlacement.Bottom,
		priority: 5,
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
	},
	[UserAction.AddContext]: {
		execute: newGenCommand,
		id: UserAction.AddContext,
		label: "Add Context",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
		isAvailable: () => false, // Shortcut only
	},
	[UserAction.ExplainGrammar]: {
		execute: newGenCommand,
		id: UserAction.ExplainGrammar,
		label: "Explain Grammar",
		placement: UserActionPlacement.AboveSelection,
		priority: 3,
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
	},
	[UserAction.SplitContexts]: {
		execute: newGenCommand,
		id: UserAction.SplitContexts,
		label: "Sort Contexts",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
		isAvailable: () => false, // Shortcut only
	},
	[UserAction.SplitInBlocks]: {
		execute: newSplitCommand,
		id: UserAction.SplitInBlocks,
		label: "Split",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
		isAvailable: () => false, // Shortcut only
	},
	[UserAction.SplitToPages]: {
		execute: () => {
			// Command-only action, executed via main.ts command registration
			// This stub exists to satisfy the type requirement
		},
		id: UserAction.SplitToPages,
		label: "Split to Pages",
		placement: UserActionPlacement.Bottom,
		priority: 1,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Scroll &&
			!ctx.hasSelection,
	},
	[UserAction.TranslateBlock]: {
		execute: newGenCommand,
		id: UserAction.TranslateBlock,
		label: "Translate",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
		isAvailable: () => false, // Shortcut only
	},
	[UserAction.TranslateSelection]: {
		execute: newTranslateSelection,
		id: UserAction.TranslateSelection,
		label: "Translate",
		placement: UserActionPlacement.AboveSelection,
		priority: 1,
		isAvailable: (ctx: ButtonContext) => ctx.hasSelection,
	},
	[UserAction.MakeText]: {
		execute: makeTextAction,
		id: UserAction.MakeText,
		label: "Make this a text",
		placement: UserActionPlacement.Bottom,
		priority: 2,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary && ctx.fileType === null,
	},
	[UserAction.NavigatePage]: {
		execute: (services) => navigatePageAction(services, "next"),
		id: UserAction.NavigatePage,
		label: "→",
		placement: UserActionPlacement.Bottom,
		priority: 2,
		isAvailable: (ctx: ButtonContext) => ctx.fileType === FileType.Page,
	},
	[UserAction.PreviousPage]: {
		execute: (services) => navigatePageAction(services, "prev"),
		id: UserAction.PreviousPage,
		label: "←",
		placement: UserActionPlacement.Bottom,
		priority: 1,
		isAvailable: (ctx: ButtonContext) => ctx.fileType === FileType.Page,
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
