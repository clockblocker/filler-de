/**
 * Types for Librarian commands.
 */

import { z } from "zod";

// ─── Command Kind ───

const LIBRARIAN_COMMAND_KIND_STR = [
	"GoToNextPage",
	"GoToPrevPage",
	"SplitInBlocks",
	"SplitToPages",
	"MakeText",
] as const;

export const LibrarianCommandKindSchema = z.enum(LIBRARIAN_COMMAND_KIND_STR);
export type LibrarianCommandKind = z.infer<typeof LibrarianCommandKindSchema>;
export const LibrarianCommandKind = LibrarianCommandKindSchema.enum;
export const ALL_LIBRARIAN_COMMAND_KINDS = LibrarianCommandKindSchema.options;
