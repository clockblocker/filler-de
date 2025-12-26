import { z } from "zod";

export const SCROLL_NODE_TYPE = "Scroll" as const;
export type SCROLL_NODE_TYPE = "Scroll";

export const FILE_NODE_TYPE = "File" as const;
export type FILE_NODE_TYPE = "File";

export const SECTION_NODE_TYPE = "Section" as const;
export type SECTION_NODE_TYPE = "Section";

/** Codex filename prefix */
export const CodexCoreNameSchema = z.literal("__");
export type CODEX_CORE_NAME = z.infer<typeof CodexCoreNameSchema>;
export const CODEX_CORE_NAME = CodexCoreNameSchema.value;

export const DoneStatusSchema = z.literal("Done");
export type DONE_STATUS = z.infer<typeof DoneStatusSchema>;
export const DONE_STATUS = DoneStatusSchema.value;

export const NotStartedStatusSchema = z.literal("NotStarted");
export type NOT_STARTED_STATUS = z.infer<typeof NotStartedStatusSchema>;
export const NOT_STARTED_STATUS = NotStartedStatusSchema.value;

export const UnknownStatusSchema = z.literal("Unknown");
export type UNKNOWN_STATUS = z.infer<typeof UnknownStatusSchema>;
export const UNKNOWN_STATUS = UnknownStatusSchema.value;

export const StatusSchema = z.enum([
	DONE_STATUS,
	NOT_STARTED_STATUS,
	UNKNOWN_STATUS,
]);
export type Status = z.infer<typeof StatusSchema>;
export const Status = StatusSchema.enum;

export const CREATE_NODE_ACTION = "CreateNode" as const;
export type CREATE_NODE_ACTION = "CreateNode";

export const DELETE_NODE_ACTION = "DeleteNode" as const;
export type DELETE_NODE_ACTION = "DeleteNode";

export const CHANGE_NODE_NAME_ACTION = "ChangeNodeName" as const;
export type CHANGE_NODE_NAME_ACTION = "ChangeNodeName";

export const CHANGE_NODE_STATUS_ACTION = "ChangeNodeStatus" as const;
export type CHANGE_NODE_STATUS_ACTION = "ChangeNodeStatus";

export const MOVE_NODE_ACTION = "MoveNode" as const;
export type MOVE_NODE_ACTION = "MoveNode";

const TreeActionTypeSchema = z.enum([
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	CHANGE_NODE_NAME_ACTION,
	CHANGE_NODE_STATUS_ACTION,
	MOVE_NODE_ACTION,
]);
export type TreeActionType = z.infer<typeof TreeActionTypeSchema>;
export const TreeActionType = TreeActionTypeSchema.enum;

// Healing mode types
export const RUNTIME_MODE = "Runtime" as const;
export type RUNTIME_MODE = "Runtime";

export const INIT_MODE = "Init" as const;
export type INIT_MODE = "Init";

export const DRAG_IN_MODE = "DragIn" as const;
export type DRAG_IN_MODE = "DragIn";

const HealingModeSchema = z.enum([RUNTIME_MODE, INIT_MODE, DRAG_IN_MODE]);
export type HealingMode = z.infer<typeof HealingModeSchema>;
export const HealingMode = HealingModeSchema.enum;

// Runtime subtypes
export const BASENAME_ONLY_SUBTYPE = "BasenameOnly" as const;
export type BASENAME_ONLY_SUBTYPE = "BasenameOnly";

export const PATH_ONLY_SUBTYPE = "PathOnly" as const;
export type PATH_ONLY_SUBTYPE = "PathOnly";

export const BOTH_CHANGED_SUBTYPE = "Both" as const;
export type BOTH_CHANGED_SUBTYPE = "Both";

const RuntimeSubtypeSchema = z.enum([
	BASENAME_ONLY_SUBTYPE,
	PATH_ONLY_SUBTYPE,
	BOTH_CHANGED_SUBTYPE,
]);
export type RuntimeSubtype = z.infer<typeof RuntimeSubtypeSchema>;
export const RuntimeSubtype = RuntimeSubtypeSchema.enum;

// DragIn subtypes
export const FILE_DRAG_SUBTYPE = "File" as const;
export type FILE_DRAG_SUBTYPE = "File";

export const FOLDER_DRAG_SUBTYPE = "Folder" as const;
export type FOLDER_DRAG_SUBTYPE = "Folder";

const DragInSubtypeSchema = z.enum([FILE_DRAG_SUBTYPE, FOLDER_DRAG_SUBTYPE]);
export type DragInSubtype = z.infer<typeof DragInSubtypeSchema>;
export const DragInSubtype = DragInSubtypeSchema.enum;
