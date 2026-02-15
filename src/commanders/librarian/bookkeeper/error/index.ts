/**
 * Error types for the split-to-pages action.
 */

import { Notice } from "obsidian";
import { z } from "zod";
import { logError } from "../../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";

// ─── Error Kind Enum ───

export const SplitToPagesErrorKindSchema = z.enum([
	"NoPwd",
	"NoContent",
	"ParseFailed",
	"DispatchFailed",
]);
export type SplitToPagesErrorKind = z.infer<typeof SplitToPagesErrorKindSchema>;
export const SplitToPagesErrorKind = SplitToPagesErrorKindSchema.enum;

// ─── Error Type ───

export type SplitToPagesError = {
	kind: SplitToPagesErrorKind;
	reason: string;
};

// ─── Error Constructors ───

export const makeSplitToPagesError = {
	dispatchFailed: (reason: string): SplitToPagesError => ({
		kind: SplitToPagesErrorKind.DispatchFailed,
		reason,
	}),
	noContent: (reason: string): SplitToPagesError => ({
		kind: SplitToPagesErrorKind.NoContent,
		reason,
	}),
	noPwd: (reason: string): SplitToPagesError => ({
		kind: SplitToPagesErrorKind.NoPwd,
		reason,
	}),
	parseFailed: (reason: string): SplitToPagesError => ({
		kind: SplitToPagesErrorKind.ParseFailed,
		reason,
	}),
};

// ─── Error Messages ───

const ERROR_MESSAGES: Record<SplitToPagesErrorKind, string> = {
	[SplitToPagesErrorKind.DispatchFailed]: "Failed to split file into pages",
	[SplitToPagesErrorKind.NoContent]: "Failed to read file content",
	[SplitToPagesErrorKind.NoPwd]: "Failed to get current file",
	[SplitToPagesErrorKind.ParseFailed]: "Failed to parse file name",
};

// ─── Error Handler ───

export function handleSplitToPagesError(error: SplitToPagesError): void {
	logError({
		description: `${error.kind}: ${error.reason}`,
		location: "splitToPagesAction",
	});
	new Notice(ERROR_MESSAGES[error.kind]);
}
