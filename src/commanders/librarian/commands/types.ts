/**
 * Types for Librarian commands.
 */

import type { Effect } from "effect";
import { z } from "zod";
import type { CommandContext } from "../../../managers/obsidian/command-executor";
import type { CommandError } from "../errors";
import type { Librarian, LibrarianVam } from "../librarian";

// Re-export for convenience
export type { CommandError } from "../errors";

// ─── Command Kind ───

const LIBRARIAN_COMMAND_KIND_STR = [
	"GoToNextPage",
	"GoToPrevPage",
	"SplitInBlocks",
	"SplitToPages",
] as const;

const LibrarianCommandKindSchema = z.enum(LIBRARIAN_COMMAND_KIND_STR);
export type LibrarianCommandKind = z.infer<typeof LibrarianCommandKindSchema>;
export const LibrarianCommandKind = LibrarianCommandKindSchema.enum;
export const ALL_LIBRARIAN_COMMAND_KINDS = LibrarianCommandKindSchema.options;

// ─── Command State ───

type LibrarianState = {
	vam: LibrarianVam;
	librarian: Librarian;
	notify: (message: string) => void;
};

// ─── Command Input ───

export type LibrarianCommandInput = {
	commandContext: CommandContext & {
		activeFile: NonNullable<CommandContext["activeFile"]>;
	};
	librarianState: LibrarianState;
};

// ─── Command Function ───

export type LibrarianCommandFn = (
	input: LibrarianCommandInput,
) => Effect.Effect<void, CommandError>;
