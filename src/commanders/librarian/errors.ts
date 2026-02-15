import z from "zod";

// ─── Command Error ───

const COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
	"NoSelection",
] as const;

export const CommandErrorKindSchema = z.enum(COMMAND_ERROR_KIND_STR);
export type CommandErrorKind = z.infer<typeof CommandErrorKindSchema>;
export const CommandErrorKind = CommandErrorKindSchema.enum;

export type CommandError =
	| { kind: typeof CommandErrorKind.NotMdFile }
	| { kind: typeof CommandErrorKind.NotEligible; reason: string }
	| { kind: typeof CommandErrorKind.DispatchFailed; reason: string }
	| { kind: typeof CommandErrorKind.NoSelection };
