/**
 * Types for Textfresser commands.
 */

import type { ResultAsync } from "neverthrow";
import { z } from "zod";
import type { CommandContext } from "../../../managers/obsidian/user-actions-manager/types";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import type { CommandError } from "../errors";
import type { TextfresserState } from "../textfresser";

// Re-export for convenience
export type { CommandError } from "../errors";
export { CommandErrorKind } from "../errors";

// ─── Command Kind ───

const TEXTFRESSER_COMMAND_KIND_STR = [
	"Generate",
	"Lemma",
	"TranslateSelection",
] as const;

export const TextfresserCommandKindSchema = z.enum(
	TEXTFRESSER_COMMAND_KIND_STR,
);
export type TextfresserCommandKind = z.infer<
	typeof TextfresserCommandKindSchema
>;
export const TextfresserCommandKind = TextfresserCommandKindSchema.enum;
export const ALL_TEXTFRESSER_COMMAND_KINDS =
	TextfresserCommandKindSchema.options;

// ─── Command Input ───

export type CommandInput = {
	resultingActions: VaultAction[];
	commandContext: CommandContext & {
		activeFile: NonNullable<CommandContext["activeFile"]>;
	};
	textfresserState: TextfresserState;
};

/** Accumulating state that flows through a Textfresser command pipeline. */
export type CommandState = CommandInput & { actions: VaultAction[] };

/** Function signature for Textfresser commands */
export type CommandFn = (
	input: CommandInput,
) => ResultAsync<VaultAction[], CommandError>;

// ─── Eligibility Schema ───

export const EligibilitySchema = z.looseObject({
	noteKind: z.string().optional(),
});

export type Eligibility = z.infer<typeof EligibilitySchema>;
