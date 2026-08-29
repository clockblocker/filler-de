import { z } from "zod";

// Nodes

const ScrollSchema = z.literal("Scroll");
export type SCROLL = z.infer<typeof ScrollSchema>;
export const SCROLL = ScrollSchema.value;

const PageSchema = z.literal("Page");
export type PAGE = z.infer<typeof PageSchema>;
export const PAGE = PageSchema.value;

// Meta

const CodexSchema = z.literal("Codex");
export type CODEX = z.infer<typeof CodexSchema>;
export const CODEX = CodexSchema.value;

const EntrySchema = z.literal("Entry");
export type ENTRY = z.infer<typeof EntrySchema>;
export const ENTRY = EntrySchema.value;

const UnknownSchema = z.literal("Unknown");
export type UNKNOWN = z.infer<typeof UnknownSchema>;
export const UNKNOWN = UnknownSchema.value;

// Node statuses
