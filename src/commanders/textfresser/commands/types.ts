/**
 * Types for Textfresser commands.
 */

import type { Result } from "neverthrow";
import { z } from "zod";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Prettify } from "../../../types/helpers";
import type { Attestation } from "../dtos/attestation/types";

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

// ─── Command Error ───

const COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
] as const;

export type CommandErrorKind = (typeof COMMAND_ERROR_KIND_STR)[number];

export type CommandError =
	| { kind: "NotMdFile" }
	| { kind: "NotEligible"; reason: string }
	| { kind: "DispatchFailed"; reason: string };

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
