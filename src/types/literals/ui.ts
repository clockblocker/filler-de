import { z } from "zod";

// Format


const SpaceFormatSchema = z.literal(" ");
export type SPACE_F = z.infer<typeof SpaceFormatSchema>;
export const SPACE_F = SpaceFormatSchema.value;

const TabSchema = z.literal("\t");
export type TAB = z.infer<typeof TabSchema>;
export const TAB = TabSchema.value;

const LineBreakSchema = z.literal("\n");
export type LINE_BREAK = z.infer<typeof LineBreakSchema>;
export const LINE_BREAK = LineBreakSchema.value;




const ObsidianLinkOpenSchema = z.literal("[[");
export type OBSIDIAN_LINK_OPEN = z.infer<typeof ObsidianLinkOpenSchema>;
export const OBSIDIAN_LINK_OPEN = ObsidianLinkOpenSchema.value;

const ObsidianLinkCloseSchema = z.literal("]]");
export type OBSIDIAN_LINK_CLOSE = z.infer<typeof ObsidianLinkCloseSchema>;
export const OBSIDIAN_LINK_CLOSE = ObsidianLinkCloseSchema.value;

const DoneCheckboxSchema = z.literal("- [x]");
export type DONE_CHECKBOX = z.infer<typeof DoneCheckboxSchema>;
export const DONE_CHECKBOX = DoneCheckboxSchema.value;

const NotStartedCheckboxSchema = z.literal("- [ ]");
export type NOT_STARTED_CHECKBOX = z.infer<typeof NotStartedCheckboxSchema>;
export const NOT_STARTED_CHECKBOX = NotStartedCheckboxSchema.value;


const PipeSchema = z.literal("|");
export type PIPE = z.infer<typeof PipeSchema>;
export const PIPE = PipeSchema.value;



export const SmallEmDashSchema = z.literal("﹘");
export type SMALL_EM_DASH = z.infer<typeof SmallEmDashSchema>;
export const SMALL_EM_DASH = SmallEmDashSchema.value;

const DashSchema = z.literal("-");
export type DASH = z.infer<typeof DashSchema>;
export const DASH = DashSchema.value;




