/**
 * Types for the Generate command.
 */

import { z } from "zod";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";

// ─── Context ───

export type GenerateContext = {
	splitPath: SplitPathToMdFile;
	content: string;
	actions: VaultAction[];
	vam: VaultActionManager;
};

// ─── Errors ───

export type GenerateError =
	| { kind: "NotMdFile" }
	| { kind: "NotEligible"; noteKind: string }
	| { kind: "DispatchFailed"; reason: string };

export const GenerateErrorKind = {
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
