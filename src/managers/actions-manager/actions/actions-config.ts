import { FileType } from "../../../types/common-interface/enums";
import { BACK_ARROW, FORWARD_ARROW } from "../../../types/literals";
import { makeTextAction } from "./executors/make-text-action";
import { navigatePageAction } from "./executors/navigate-pages-action";
import { splitIntoPagesAction } from "./executors/split-into-pages";
import { splitSelectionInBlocksAction } from "./executors/split-selection-blocks-action";
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
		execute: splitIntoPagesAction,
		id: UserAction.SplitToPages,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Scroll &&
			!ctx.hasSelection,
		label: "Split to Pages",
		placement: UserActionPlacement.Bottom,
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
		label: "Split into pages",
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserAction.NavigatePage]: {
		execute: (services) => navigatePageAction(services, "next"),
		id: UserAction.NavigatePage,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null,
		isEnabled: (ctx: ButtonContext) => ctx.hasNextPage,
		label: FORWARD_ARROW,
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserAction.PreviousPage]: {
		execute: (services) => navigatePageAction(services, "prev"),
		id: UserAction.PreviousPage,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null,
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

export const CHANGE_FILE_TYPE_ACTIONS: UserAction[] = [] as const;

export const OPTIONAL_BOTTOM_ACTIONS = [...NAVIGATE_PAGE_ACTIONS];
