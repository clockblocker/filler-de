import { z } from "zod";
import type { FileType } from "../../types/common-interface/enums";
import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../obsidian/vault-action-manager/types/split-path";

// ─── CommandKind - Command Executor Action Kinds ───

/**
 * All known command kinds for the command executor.
 */
export const CommandKind = {
	ExplainGrammar: "ExplainGrammar",
	Generate: "Generate",
	MakeText: "MakeText",
	NavigatePage: "NavigatePage",
	SplitInBlocks: "SplitInBlocks",
	SplitToPages: "SplitToPages",
	TestButton: "TestButton",
	TranslateSelection: "TranslateSelection",
} as const;
export type CommandKind = (typeof CommandKind)[keyof typeof CommandKind];

/**
 * Typed payloads per command kind.
 * Each executor receives only its typed payload.
 */
export type CommandPayloads = {
	NavigatePage: {
		direction: "prev" | "next";
		currentFilePath: SplitPathToMdFile;
	};
	SplitInBlocks: { selection: string; fileContent: string };
	MakeText: Record<string, never>;
	SplitToPages: Record<string, never>;
	TestButton: { filePath: SplitPathToMdFile };
	TranslateSelection: { selection: string };
	ExplainGrammar: { selection: string };
	Generate: Record<string, never>;
};

// ─── Deprecated Types (for backward compatibility) ───

/**
 * @deprecated Use CommandKind instead. Alias for backward compatibility.
 */
export const ActionKind = CommandKind;
/**
 * @deprecated Use CommandKind instead. Alias for backward compatibility.
 */
export type ActionKind = CommandKind;

/**
 * @deprecated Use CommandPayloads instead. Alias for backward compatibility.
 */
export type ActionPayloads = CommandPayloads;

// ─── UserCommandKind - Legacy Button Types ───

/** @deprecated Services interface - to be removed */
export type TexfresserObsidianServices = Record<string, unknown>;

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
