import { z } from "zod";
import { ALL_LIBRARIAN_COMMAND_KINDS } from "../../commanders/librarian/commands/types";
import { ALL_TEXTFRESSER_COMMAND_KINDS } from "../../commanders/textfresser/commands/types";
import type { SelectionInfo } from "../obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";

// ─── CommandKind - Command Executor Action Kinds ───

const COMMAND_KIND_STR = [
	...ALL_TEXTFRESSER_COMMAND_KINDS,
	...ALL_LIBRARIAN_COMMAND_KINDS,
] as const;

export const CommandKindSchema = z.enum(COMMAND_KIND_STR);
export type CommandKind = z.infer<typeof CommandKindSchema>;
export const CommandKind = CommandKindSchema.enum;

/**
 * Typed payloads per command kind.
 * Each executor receives only its typed payload.
 */
export type CommandPayloads = {
	// Librarian commands
	GoToNextPage: Record<string, never>;
	GoToPrevPage: Record<string, never>;
	SplitInBlocks: Record<string, never>; // uses context.selection
	MakeText: Record<string, never>;
	SplitToPages: Record<string, never>;

	// Textfresser commands
	TranslateSelection: Record<string, never>; // uses context.selection
	Generate: Record<string, never>;
	Lemma: Record<string, never>;
};

/**
 * Context collected once at command invocation.
 * Passed to all commands by default.
 */
export type CommandContext = {
	/** Selection info from vam.selection.getInfo() */
	selection: SelectionInfo | null;
	/** Current md file path from vam.mdPwd() */
	splitPath: SplitPathToMdFile | null;
};
