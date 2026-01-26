import { z } from "zod";
import type { TexfresserObsidianServices } from "../../deprecated-services/obsidian-services/interface";
import type { FileType } from "../../types/common-interface/enums";
import type { AnySplitPath } from "../obsidian/vault-action-manager/types/split-path";

const USER_COMMAND_LITERALS = [
	"SplitInBlocks",
	"SplitToPages",
	"MakeText",
	"NavigatePage",
	"PreviousPage",
] as const;

/**
 * @deprecated Use OverlayPlacement from overlay-manager/action-definitions instead.
 * This will be removed in a future version.
 */
const USER_COMMAND_PLACEMENT_LITERALS = [
	"AboveSelection",
	"Bottom",
	"ShortcutOnly",
] as const;

export const UserCommandSchema = z.enum(USER_COMMAND_LITERALS);

export type UserCommandKind = z.infer<typeof UserCommandSchema>;
export const UserCommandKind = UserCommandSchema.enum;
export const ALL_USER_COMMAND_KINDS = UserCommandSchema.options;

export const UserCommandPlacementSchema = z.enum(
	USER_COMMAND_PLACEMENT_LITERALS,
);

export type UserCommandPlacement = z.infer<typeof UserCommandPlacementSchema>;
export const UserCommandPlacement = UserCommandPlacementSchema.enum;
export const USER_COMMAND_PLACEMENTS = UserCommandPlacementSchema.options;

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

export type CommandConfig<K extends UserCommandKind> = {
	kind: K;
	execute: (
		services: Partial<TexfresserObsidianServices>,
	) => void | Promise<void>;
	label: string;
	placement: UserCommandPlacement;
	/** Lower number = higher priority (1-10). Used for sorting and overflow. */
	priority: number;
	/** Predicate to determine if command is available in current context */
	isAvailable: (ctx: ButtonContext) => boolean;
	/** Optional predicate to determine if command is enabled (shown but inactive if false) */
	isEnabled?: (ctx: ButtonContext) => boolean;
};

export type AnyCommandConfig = CommandConfig<UserCommandKind>;

/** Command config with computed disabled state for rendering */
export type RenderedCommandConfig = AnyCommandConfig & {
	disabled: boolean;
};
