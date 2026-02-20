import z from "zod";
import { getErrorMessage } from "../../utils/get-error-message";
import {
	BASE_COMMAND_ERROR_KIND_STR,
	type BaseCommandError,
} from "../base-command-error";

// ─── Command Error ───

const COMMAND_ERROR_KIND_STR = [
	...BASE_COMMAND_ERROR_KIND_STR,
	"ApiError",
	"UNUSED_STUB",
] as const;

export const CommandErrorKindSchema = z.enum(COMMAND_ERROR_KIND_STR);
export type CommandErrorKind = z.infer<typeof CommandErrorKindSchema>;
export const CommandErrorKind = CommandErrorKindSchema.enum;

type TextfresserSpecificCommandError =
	| { kind: typeof CommandErrorKind.ApiError; reason: string }
	| { kind: typeof CommandErrorKind.UNUSED_STUB };

export type TextfresserCommandError =
	| BaseCommandError
	| TextfresserSpecificCommandError;
export type CommandError = TextfresserCommandError;

// ─── Attestation Parsing Error ───

const ATT_PARSING_ERROR_KIND_STR = [
	"WikilinkNotFound",
	"BlockIdNotFound",
] as const;

export const AttestationParsingErrorKindSchema = z.enum(
	ATT_PARSING_ERROR_KIND_STR,
);
export type AttestationParsingErrorKind = z.infer<
	typeof AttestationParsingErrorKindSchema
>;
export const AttestationParsingErrorKind =
	AttestationParsingErrorKindSchema.enum;

export type AttestationParsingError =
	| { kind: typeof AttestationParsingErrorKind.WikilinkNotFound }
	| { kind: typeof AttestationParsingErrorKind.BlockIdNotFound };

// ─── Error Helpers ───

/** Extract a human-readable reason from a CommandError. */
export function extractErrorReason(error: CommandError): string {
	return "reason" in error ? error.reason : `Command failed: ${error.kind}`;
}

/** Convert an unknown thrown value into an ApiError CommandError. */
export function toApiCommandError(error: unknown): CommandError {
	return {
		kind: CommandErrorKind.ApiError,
		reason: getErrorMessage(error),
	};
}
