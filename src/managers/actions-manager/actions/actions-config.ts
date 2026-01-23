import { Notice } from "obsidian";
import type { TexfresserObsidianServices } from "../../../deprecated-services/obsidian-services/interface";
import { FileType } from "../../../types/common-interface/enums";
import { BACK_ARROW, FORWARD_ARROW } from "../../../types/literals";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";
import { SplitPathKind } from "../../obsidian/vault-action-manager/types/split-path";
import { navigatePageAction } from "./executors/navigate-pages-action";
import { splitIntoPagesAction } from "./executors/split-into-pages";
import { splitSelectionInBlocksAction } from "./executors/split-selection-blocks-action";
import {
	type ActionConfig,
	ALL_USER_ACTION_KINDS,
	type ButtonContext,
	UserActionKind,
	UserActionPlacement,
} from "./types";

/**
 * Legacy wrapper: adapts new pure executor to old services-based interface.
 */
async function legacySplitInBlocks(services: {
	vaultActionManager: VaultActionManager;
}): Promise<void> {
	const { vaultActionManager } = services;
	const openedFileService = vaultActionManager.openedFileService;

	const selection = openedFileService.getSelection();
	if (!selection?.trim()) {
		new Notice("No text selected");
		return;
	}

	const contentResult = await vaultActionManager.getOpenedContent();
	if (contentResult.isErr()) {
		new Notice(`Error: ${contentResult.error}`);
		return;
	}

	splitSelectionInBlocksAction(
		{ fileContent: contentResult.value, selection },
		{
			notify: (msg) => new Notice(msg),
			replaceSelection: (text) =>
				openedFileService.replaceSelection(text),
		},
	);
}

/**
 * Legacy wrapper: adapts new pure executor to old services-based interface.
 */
async function legacyNavigatePage(
	services: Partial<TexfresserObsidianServices>,
	direction: "prev" | "next",
): Promise<void> {
	const { librarian, vaultActionManager } = services;
	if (!librarian || !vaultActionManager) return;

	const currentFilePath =
		vaultActionManager.openedFileService.getOpenedFile();
	if (!currentFilePath || currentFilePath.kind !== SplitPathKind.MdFile) {
		return;
	}

	await navigatePageAction(
		{ currentFilePath, direction },
		{
			getAdjacentPage: (path, dir) =>
				dir === -1
					? librarian.getPrevPage(path)
					: librarian.getNextPage(path),
			navigate: (path) => vaultActionManager.cd(path),
		},
	);
}

/**
 * Action configurations with visibility predicates.
 * Each action defines when it should be shown via isAvailable().
 * Priority determines button order (lower = higher priority).
 */
export const ACTION_CONFIGS = {
	[UserActionKind.SplitInBlocks]: {
		execute: legacySplitInBlocks,
		isAvailable: (ctx: ButtonContext) =>
			ctx.hasSelection && ctx.isInLibrary,
		kind: UserActionKind.SplitInBlocks,
		label: "Split in Blocks",
		placement: UserActionPlacement.AboveSelection,
		priority: 2,
	},
	[UserActionKind.SplitToPages]: {
		execute: splitIntoPagesAction,
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Scroll &&
			!ctx.hasSelection,
		kind: UserActionKind.SplitToPages,
		label: "Split to Pages",
		placement: UserActionPlacement.Bottom,
		priority: 1,
	},
	[UserActionKind.MakeText]: {
		execute: splitIntoPagesAction, // Same as SplitToPages
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			(ctx.fileType === null ||
				(ctx.fileType === FileType.Scroll &&
					ctx.wouldSplitToMultiplePages)),
		kind: UserActionKind.MakeText,
		label: "Split into pages",
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserActionKind.NavigatePage]: {
		execute: (services: Partial<TexfresserObsidianServices>) =>
			legacyNavigatePage(services, "next"),
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null,
		isEnabled: (ctx: ButtonContext) => ctx.hasNextPage,
		kind: UserActionKind.NavigatePage,
		label: FORWARD_ARROW,
		placement: UserActionPlacement.Bottom,
		priority: 2,
	},
	[UserActionKind.PreviousPage]: {
		execute: (services: Partial<TexfresserObsidianServices>) =>
			legacyNavigatePage(services, "prev"),
		isAvailable: (ctx: ButtonContext) =>
			ctx.isInLibrary &&
			ctx.fileType === FileType.Page &&
			ctx.pageIndex !== null,
		isEnabled: (ctx: ButtonContext) =>
			ctx.pageIndex !== null && ctx.pageIndex > 0,
		kind: UserActionKind.PreviousPage,
		label: BACK_ARROW,
		placement: UserActionPlacement.Bottom,
		priority: 1,
	},
} satisfies { [A in UserActionKind]: ActionConfig<A> };

export const getAllAboveSelectionActions = (): UserActionKind[] =>
	[...ALL_USER_ACTION_KINDS].filter(
		(action) =>
			ACTION_CONFIGS[action].placement ===
			UserActionPlacement.AboveSelection,
	);

export const getAllBottomActions = (): UserActionKind[] =>
	[...ALL_USER_ACTION_KINDS].filter(
		(action) =>
			ACTION_CONFIGS[action].placement === UserActionPlacement.Bottom,
	);

export const NAVIGATE_PAGE_ACTIONS: UserActionKind[] = [
	UserActionKind.PreviousPage,
	UserActionKind.NavigatePage,
] as const;

export const CHANGE_FILE_TYPE_ACTIONS: UserActionKind[] = [] as const;

export const OPTIONAL_BOTTOM_ACTIONS = [...NAVIGATE_PAGE_ACTIONS];
