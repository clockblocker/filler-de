import { z } from "zod";
import type { TexfresserObsidianServices } from "../../deprecated-services/obsidian-services/interface";
import type { FileType } from "../../types/common-interface/enums";
import type { AnySplitPath } from "../obsidian/vault-action-manager/types/split-path";

const USER_ACTION_LITERALS = [
	"SplitInBlocks",
	"SplitToPages",
	"MakeText",
	"NavigatePage",
	"PreviousPage",
] as const;

const USER_ACTION_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

export const UserActionSchema = z.enum(USER_ACTION_LITERALS);

export type UserActionKind = z.infer<typeof UserActionSchema>;
export const UserActionKind = UserActionSchema.enum;
export const ALL_USER_ACTION_KINDS = UserActionSchema.options;

export const UserActionPlacementSchema = z.enum(USER_ACTION_PLACEMENT_LITERALS);

export type UserActionPlacement = z.infer<typeof UserActionPlacementSchema>;
export const UserActionPlacement = UserActionPlacementSchema.enum;
export const USER_ACTION_PLACEMENTS = UserActionPlacementSchema.options;

/**
 * Context available when evaluating button visibility.
 * Built from current active file and selection state.
 */
export type ButtonContext = {
	/** Current file path, or null if no file open */
	path: AnySplitPath | null;
	/** Parsed file type from metadata (Page, Scroll, Text, etc.) */
	fileType: FileType | null;
	/** Whether there is an active text selection */
	hasSelection: boolean;
	/** Whether running on mobile device */
	isMobile: boolean;
	/** Whether file is inside the library folder */
	isInLibrary: boolean;
	/** Whether scroll content would split into >1 page */
	wouldSplitToMultiplePages: boolean;
	/** Page index (0-999) for Page files, null otherwise */
	pageIndex: number | null;
	/** Whether next page exists in vault (for Page files) */
	hasNextPage: boolean;
};

export type ActionConfig<K extends UserActionKind> = {
	kind: K;
	execute: (
		services: Partial<TexfresserObsidianServices>,
	) => void | Promise<void>;
	label: string;
	placement: UserActionPlacement;
	/** Lower number = higher priority (1-10). Used for sorting and overflow. */
	priority: number;
	/** Predicate to determine if action is available in current context */
	isAvailable: (ctx: ButtonContext) => boolean;
	/** Optional predicate to determine if action is enabled (shown but inactive if false) */
	isEnabled?: (ctx: ButtonContext) => boolean;
};

export type AnyActionConfig = ActionConfig<UserActionKind>;

/** Action config with computed disabled state for rendering */
export type RenderedActionConfig = AnyActionConfig & {
	disabled: boolean;
};
