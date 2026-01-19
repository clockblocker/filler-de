import { z } from "zod";
import type { AnySplitPath } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { FileType } from "../../../types/common-interface/enums";
import type { TexfresserObsidianServices } from "../../obsidian-services/interface";

const USER_ACTION_LITERALS = [
	"Generate",
	"AddContext",
	"SplitContexts",
	"SplitInBlocks",
	"SplitToPages",
	"TranslateSelection",
	"TranslateBlock",
	"ExplainGrammar",
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

export type UserAction = z.infer<typeof UserActionSchema>;
export const UserAction = UserActionSchema.enum;
export const ALL_USER_ACTIONS = UserActionSchema.options;

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
};

export type ActionConfig<A extends UserAction> = {
	id: A;
	execute: (services: Partial<TexfresserObsidianServices>) => void;
	label: string;
	placement: UserActionPlacement;
	/** Lower number = higher priority (1-10). Used for sorting and overflow. */
	priority: number;
	/** Predicate to determine if action is available in current context */
	isAvailable: (ctx: ButtonContext) => boolean;
};

export type AnyActionConfig = ActionConfig<UserAction>;
