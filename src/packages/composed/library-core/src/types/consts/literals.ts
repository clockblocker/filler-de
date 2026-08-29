import { z } from "zod";

export const SCROLL_NODE_TYPE = "Scroll" as const;
export type SCROLL_NODE_TYPE = "Scroll";

export const FILE_NODE_TYPE = "File" as const;
export type FILE_NODE_TYPE = "File";

export const SECTION_NODE_TYPE = "Section" as const;
export type SECTION_NODE_TYPE = "Section";

/** Codex filename prefix */
const PrefixOfCodexSchema = z.literal("__");
export type PREFIX_OF_CODEX = z.infer<typeof PrefixOfCodexSchema>;
export const PREFIX_OF_CODEX = PrefixOfCodexSchema.value;

const DoneStatusSchema = z.literal("Done");
export type DONE_STATUS = z.infer<typeof DoneStatusSchema>;
export const DONE_STATUS = DoneStatusSchema.value;

const NotStartedStatusSchema = z.literal("NotStarted");
export type NOT_STARTED_STATUS = z.infer<typeof NotStartedStatusSchema>;
export const NOT_STARTED_STATUS = NotStartedStatusSchema.value;

const UnknownStatusSchema = z.literal("Unknown");
export type UNKNOWN_STATUS = z.infer<typeof UnknownStatusSchema>;
export const UNKNOWN_STATUS = UnknownStatusSchema.value;

const RenameSchema = z.literal("Rename");
export type RENAME = z.infer<typeof RenameSchema>;
export const RENAME = RenameSchema.value;

const ChangeStatusSchema = z.literal("ChangeStatus");
export type CHANGE_STATUS = z.infer<typeof ChangeStatusSchema>;
export const CHANGE_STATUS = ChangeStatusSchema.value;

const MoveSchema = z.literal("Move");
export type MOVE = z.infer<typeof MoveSchema>;
export const MOVE = MoveSchema.value;

// Healing mode types

// Runtime subtypes

// DragIn subtypes

/** Codex filename prefix */
const CustomErrorCodeSchema = z.literal("custom");
export type CUSTOM_ERROR_CODE = z.infer<typeof CustomErrorCodeSchema>;
export const CUSTOM_ERROR_CODE = CustomErrorCodeSchema.value;
