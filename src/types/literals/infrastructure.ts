import { z } from "zod";

// Nodes
export const TextSchema = z.literal("Text");
export type TEXT = z.infer<typeof TextSchema>;
export const TEXT = TextSchema.value;

export const BookSchema = z.literal("Book");
export type BOOK = z.infer<typeof BookSchema>;
export const BOOK = BookSchema.value;

export const ScrollSchema = z.literal("Scroll");
export type SCROLL = z.infer<typeof ScrollSchema>;
export const SCROLL = ScrollSchema.value;

export const SectionSchema = z.literal("Section");
export type SECTION = z.infer<typeof SectionSchema>;
export const SECTION = SectionSchema.value;

export const PageSchema = z.literal("Page");
export type PAGE = z.infer<typeof PageSchema>;
export const PAGE = PageSchema.value;

export const NoteSchema = z.literal("Note");
export type NOTE = z.infer<typeof NoteSchema>;
export const NOTE = NoteSchema.value;

// Meta
export const UnmarkedSchema = z.literal("Unmarked");
export type UNMARKED = z.infer<typeof UnmarkedSchema>;
export const UNMARKED = UnmarkedSchema.value;

export const CodexSchema = z.literal("Codex");
export type CODEX = z.infer<typeof CodexSchema>;
export const CODEX = CodexSchema.value;

export const EntrySchema = z.literal("Entry");
export type ENTRY = z.infer<typeof EntrySchema>;
export const ENTRY = EntrySchema.value;

export const UnknownSchema = z.literal("Unknown");
export type UNKNOWN = z.infer<typeof UnknownSchema>;
export const UNKNOWN = UnknownSchema.value;

// Node statuses
export const DoneSchema = z.literal("Done");
export type DONE = z.infer<typeof DoneSchema>;
export const DONE = DoneSchema.value;

export const NotStartedSchema = z.literal("NotStarted");
export type NOT_STARTED = z.infer<typeof NotStartedSchema>;
export const NOT_STARTED = NotStartedSchema.value;

export const InProgressSchema = z.literal("InProgress");
export type IN_PROGRESS = z.infer<typeof InProgressSchema>;
export const IN_PROGRESS = InProgressSchema.value;
