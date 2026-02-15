import z from "zod";
import {
	type BaseCommandError,
	BASE_COMMAND_ERROR_KIND_STR,
} from "../base-command-error";

// ─── Command Error ───

const COMMAND_ERROR_KIND_STR = [...BASE_COMMAND_ERROR_KIND_STR] as const;

export const CommandErrorKindSchema = z.enum(COMMAND_ERROR_KIND_STR);
export type CommandErrorKind = z.infer<typeof CommandErrorKindSchema>;
export const CommandErrorKind = CommandErrorKindSchema.enum;

export type LibrarianCommandError = BaseCommandError;
export type CommandError = LibrarianCommandError;
