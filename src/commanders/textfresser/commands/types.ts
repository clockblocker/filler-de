/**
 * Types for Textfresser commands.
 */

import type { Result } from "neverthrow";
import { z } from "zod";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Prettify } from "../../../types/helpers";
import type { Attestation } from "../dtos/attestation/types";
import type { CommandError } from "../errors";

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

// ─── Common Command Input ───

type CurrentFileInfo = {
	path: SplitPathToMdFile;
	content: string;
};

type PayloadByKind = {
	[TextfresserCommandKind.Generate]: {
		attestation: Attestation;
	};
	[TextfresserCommandKind.Lemma]: {
		attestation: Attestation;
	};
	[TextfresserCommandKind.TranslateSelection]: {
		selection: string;
	};
};

type CommonCommandInput = {
	resultingActions: VaultAction[];
	currentFileInfo: CurrentFileInfo;
};

export type CommandInput<
	K extends TextfresserCommandKind = TextfresserCommandKind,
> = Prettify<
	CommonCommandInput & {
		kind: K;
	} & PayloadByKind[K]
>;

/**
 * Accumulating state that flows through a Textfresser command pipeline.
 *
 * Combines:
 *  - the command-specific input for the given `kind` (`CommandInput<K>`), and
 *  - `actions` accumulator that pipeline steps append to.
 */
export type CommandState<
	K extends TextfresserCommandKind = TextfresserCommandKind,
> = CommandInput<K> & { actions: VaultAction[] };

/** Function signature for Textfresser commands */
export type CommandFn<
	K extends TextfresserCommandKind = TextfresserCommandKind,
> = (input: CommandInput<K>) => Result<VaultAction[], CommandError>;

// ─── Eligibility Schema ───

export const EligibilitySchema = z.looseObject({
	noteKind: z.string().optional(),
});

export type Eligibility = z.infer<typeof EligibilitySchema>;

// ─── DictEntry NoteKind ───

export const DICT_ENTRY_NOTE_KIND = "DictEntry" as const;

