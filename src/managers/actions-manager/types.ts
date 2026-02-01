import { z } from "zod";
import { ALL_LIBRARIAN_COMMAND_KINDS } from "../../commanders/librarian/commands/types";
import { ALL_TEXTFRESSER_COMMAND_KINDS } from "../../commanders/textfresser/commands/types";

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
	SplitInBlocks: { selection: string; fileContent: string };
	MakeText: Record<string, never>;
	SplitToPages: Record<string, never>;

	// Textfresser commands
	TranslateSelection: { selection: string };
	Generate: Record<string, never>;
	Lemma: Record<string, never>;
};
