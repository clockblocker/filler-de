import z from "zod";

// ─── Command Error ───

const COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
] as const;

export const CommandErrorKindSchema = z.enum(COMMAND_ERROR_KIND_STR);
export type CommandErrorKind = z.infer<typeof CommandErrorKindSchema>;
export const CommandErrorKind = CommandErrorKindSchema.enum;

export type CommandError =
	| { kind: typeof CommandErrorKind.NotMdFile }
	| { kind: typeof CommandErrorKind.NotEligible; reason: string }
	| { kind: typeof CommandErrorKind.DispatchFailed; reason: string };

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
