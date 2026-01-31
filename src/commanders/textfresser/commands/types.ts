/**
 * Types for Textfresser commands.
 */

import type { Result } from "neverthrow";
import { z } from "zod";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TextfresserState } from "../types";

// ─── Command Kind ───

export const TextfresserCommandKindSchema = z.enum(["Generate", "Baseform"]);
export type TextfresserCommandKind = z.infer<typeof TextfresserCommandKindSchema>;
export const TextfresserCommandKind = TextfresserCommandKindSchema.enum;

// ─── Command Input ───

/** Input for command functions (from fs-utils + state) */
export type CommandInput = {
	splitPath: SplitPathToMdFile;
	content: string;
	state: TextfresserState;
};

/** Function signature for Textfresser commands */
export type CommandFn = (input: CommandInput) => Result<VaultAction[], CommandError>;

/** Internal payload passed through pipeline steps */
export type CommandPayload = {
	splitPath: SplitPathToMdFile;
	content: string;
	actions: VaultAction[];
	state: TextfresserState;
};

// ─── Errors ───

export type CommandError =
	| { kind: "NotMdFile" }
	| { kind: "NotEligible"; noteKind: string }
	| { kind: "DispatchFailed"; reason: string };

export const CommandErrorKind = {
	DispatchFailed: "DispatchFailed",
	NotEligible: "NotEligible",
	NotMdFile: "NotMdFile",
} as const;

// ─── Eligibility Schema ───

export const EligibilitySchema = z
	.object({
		noteKind: z.string().optional(),
	})
	.passthrough();

export type Eligibility = z.infer<typeof EligibilitySchema>;

// ─── DictEntry NoteKind ───

export const DICT_ENTRY_NOTE_KIND = "DictEntry" as const;
