/**
 * Types for Librarian commands.
 */

import type { ResultAsync } from "neverthrow";
import { z } from "zod";
import type { CommandContext } from "../../../managers/actions-manager/types";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { CommandError } from "../errors";
import type { Librarian } from "../librarian";

// Re-export for convenience
export type { CommandError } from "../errors";
export { CommandErrorKind } from "../errors";

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

// ─── Command State ───

export type LibrarianState = {
	vam: VaultActionManager;
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
) => ResultAsync<void, CommandError>;
