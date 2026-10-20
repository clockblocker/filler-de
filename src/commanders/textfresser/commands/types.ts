/**
 * Types for Textfresser commands.
 */

import { z } from "zod";
import type { CommandContext } from "../../../managers/obsidian/command-executor";
import type { TextfresserState } from "../state/textfresser-state";

// Re-export for convenience
export type { CommandError } from "../errors";
export { CommandErrorKind, commandApiError } from "../errors";

// ─── Command Kind ───

const TEXTFRESSER_COMMAND_KIND_STR = ["TranslateSelection"] as const;

const TextfresserCommandKindSchema = z.enum(TEXTFRESSER_COMMAND_KIND_STR);
export type TextfresserCommandKind = z.infer<
	typeof TextfresserCommandKindSchema
>;
export const ALL_TEXTFRESSER_COMMAND_KINDS =
	TextfresserCommandKindSchema.options;

// ─── Command Input ───

export type CommandInput = {
	commandContext: CommandContext & {
		activeFile: NonNullable<CommandContext["activeFile"]>;
	};
	textfresserState: TextfresserState;
};
