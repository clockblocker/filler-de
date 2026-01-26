import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { FileType } from "../../../types/common-interface/enums";

/**
 * Action placement determines where the action button appears.
 */
export const ActionPlacement = {
	Bottom: "bottom",
	Edge: "edge",
	Selection: "selection",
} as const;
export type ActionPlacement =
	(typeof ActionPlacement)[keyof typeof ActionPlacement];

/**
 * All known action kinds.
 */
export const ActionKind = {
	ExplainGrammar: "ExplainGrammar",
	Generate: "Generate",
	MakeText: "MakeText",
	NavigatePage: "NavigatePage",
	SplitInBlocks: "SplitInBlocks",
	SplitToPages: "SplitToPages",
	TestButton: "TestButton",
	TranslateSelection: "TranslateSelection",
} as const;
export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];

/**
 * Typed payloads per action kind.
 * Each executor receives only its typed payload.
 */
export type ActionPayloads = {
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
	Generate: { selection: string };
};

/**
 * @deprecated Use ActionPayloads instead. Kept for backward compatibility during migration.
 */
export type ActionParams = {
	NavigatePage: { direction: "next" | "prev" };
	MakeText: Record<string, never>;
	SplitToPages: Record<string, never>;
	TestButton: Record<string, never>;
	TranslateSelection: Record<string, never>;
	ExplainGrammar: Record<string, never>;
	SplitInBlocks: Record<string, never>;
	Generate: Record<string, never>;
};

/**
 * A commander action with typed params.
 */
export type CommanderAction<K extends ActionKind = ActionKind> = {
	kind: K;
	params: ActionParams[K];
	label: string;
	/** Priority within commander (1-10, lower = higher priority) */
	priority: number;
	/** Where to show this action */
	placement: ActionPlacement;
	/** Whether action is disabled (shown but not clickable) */
	disabled?: boolean;
	/** Unique identifier for this action instance */
	id: string;
};

/**
 * Context available when commanders compute available actions.
 * Built from current app state.
 */
export type OverlayContext = {
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
	/** Whether previous page exists in vault (for Page files) */
	hasPrevPage: boolean;
	/** Whether next page exists in vault (for Page files) */
	hasNextPage: boolean;
	/** Current viewport width */
	viewportWidth: number;
	/** Whether editor is in source mode */
	isSourceMode: boolean;
};

/**
 * Interface for commanders to provide actions.
 * OverlayManager queries all registered providers.
 */
export interface CommanderActionProvider {
	/** Unique identifier for this commander */
	readonly id: string;
	/** Priority among commanders (1 = highest, processed first) */
	readonly priority: number;
	/** Get available actions for current context */
	getAvailableActions(context: OverlayContext): CommanderAction[];
}

/**
 * Layout state indicating which edge zones are active.
 */
export type NavigationLayoutState = {
	leftZoneActive: boolean;
	rightZoneActive: boolean;
};
