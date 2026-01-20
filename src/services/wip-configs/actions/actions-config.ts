import { FileType } from "../../../types/common-interface/enums";
import { BACK_ARROW, FORWARD_ARROW } from "../../../types/literals";
import { makeTextAction } from "./new/make-text-action";
import { navigatePageAction } from "./new/navigate-pages-action";
import newGenCommand from "./new/new-gen-command";
import { splitSelectionInBlocksAction } from "./new/split-selection-blocks-action";
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
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
		label: "Generate",
		placement: UserActionPlacement.Bottom,
		priority: 5,
	},
	[UserAction.AddContext]: {
		execute: newGenCommand,
		id: UserAction.AddContext,
		isAvailable: () => false, // Shortcut only
		label: "Add Context",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
	},
	[UserAction.ExplainGrammar]: {
		execute: newGenCommand,
		id: UserAction.ExplainGrammar,
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
		label: "Explain Grammar",
		placement: UserActionPlacement.AboveSelection,
		priority: 3,
	},
	[UserAction.SplitContexts]: {
		execute: newGenCommand,
		id: UserAction.SplitContexts,
		isAvailable: () => false, // Shortcut only
		label: "Sort Contexts",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
	},
	[UserAction.SplitInBlocks]: {
		execute: splitSelectionInBlocksAction,
		id: UserAction.SplitInBlocks,
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
		label: "Split in Blocks",
		placement: UserActionPlacement.AboveSelection,
		priority: 2,
	},
	[UserAction.SplitToPages]: {
		execute: () => {
			// Command-only action, executed via main.ts command registration
			// This stub exists to satisfy the type requirement
		},
		id: UserAction.SplitToPages,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Scroll &&
			!ctx.hasSelection,
		label: "Split to Pages",
		placement: UserActionPlacement.Bottom,
		priority: 1,
	},
	[UserAction.TranslateBlock]: {
		execute: newGenCommand,
		id: UserAction.TranslateBlock,
		isAvailable: () => false, // Shortcut only
		label: "Translate",
		placement: UserActionPlacement.ShortcutOnly,
		priority: 10,
	},
	[UserAction.TranslateSelection]: {
		execute: newTranslateSelection,
		id: UserAction.TranslateSelection,
		isAvailable: (ctx: ButtonContext) => ctx.hasSelection,
		label: "Translate",
		placement: UserActionPlacement.AboveSelection,
		priority: 1,
	},
	[UserAction.MakeText]: {
		execute: makeTextAction,
		id: UserAction.MakeText,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			(ctx.fileType === null ||
				(ctx.fileType === FileType.Scroll &&
					ctx.wouldSplitToMultiplePages)),
		label: "Make this a text",
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserAction.NavigatePage]: {
		execute: (services) => navigatePageAction(services, "next"),
		id: UserAction.NavigatePage,
		isAvailable: (ctx: ButtonContext) =>
			ctx.fileType === FileType.Page && ctx.pageIndex !== null,
		isEnabled: (ctx: ButtonContext) => ctx.hasNextPage,
		label: FORWARD_ARROW,
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserAction.PreviousPage]: {
		execute: (services) => navigatePageAction(services, "prev"),
		id: UserAction.PreviousPage,
		isAvailable: (ctx: ButtonContext) =>
			ctx.fileType === FileType.Page && ctx.pageIndex !== null,
		isEnabled: (ctx: ButtonContext) =>
			ctx.pageIndex !== null && ctx.pageIndex > 0,
		label: BACK_ARROW,
		placement: UserActionPlacement.Bottom,
		priority: 1,
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
