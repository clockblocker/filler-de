import { z } from "zod";

export const SCROLL_NODE_TYPE = "Scroll" as const;
export type SCROLL_NODE_TYPE = "Scroll";

export const FILE_NODE_TYPE = "File" as const;
export type FILE_NODE_TYPE = "File";

export const SECTION_NODE_TYPE = "Section" as const;
export type SECTION_NODE_TYPE = "Section";

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

const TreeActionTypeSchema = z.enum([
	CREATE_NODE_ACTION,
	DELETE_NODE_ACTION,
	CHANGE_NODE_NAME_ACTION,
	CHANGE_NODE_STATUS_ACTION,
]);
export type TreeActionType = z.infer<typeof TreeActionTypeSchema>;
export const TreeActionType = TreeActionTypeSchema.enum;
