import z from "zod/v4";
import { TextStatusSchema } from "../../../types/common-interface/enums";
import {
	CODEX,
	ENTRY,
	PAGE,
	SCROLL,
	UnknownSchema,
} from "../../../types/literals";

export const PageLibraryNoteMetaInfoSchema = z.object({
	fileType: z.literal(PAGE),
	index: z.int().min(0).max(999),
	status: TextStatusSchema,
});

export const ScrollLibraryNoteMetaInfoSchema = z.object({
	fileType: z.literal(SCROLL),
	status: TextStatusSchema,
});

export const CodexLibraryNoteMetaInfoSchema = z.object({
	fileType: z.literal(CODEX),
	status: TextStatusSchema,
});

export const UnknownNoteMetaInfoSchema = z.object({
	fileType: UnknownSchema,
	status: TextStatusSchema.optional(),
});

export const LibraryNoteMetaInfoSchema = z.discriminatedUnion("fileType", [
	PageLibraryNoteMetaInfoSchema,
	ScrollLibraryNoteMetaInfoSchema,
	CodexLibraryNoteMetaInfoSchema,
	UnknownNoteMetaInfoSchema,
]);

export const LinguisticNoteMetaInfoSchema = z.object({
	fileType: z.literal(ENTRY),
});

export const MetaInfoSchema = z.discriminatedUnion("fileType", [
	LibraryNoteMetaInfoSchema,
	LinguisticNoteMetaInfoSchema,
]);

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
export type LibraryNoteMetaInfo = z.infer<typeof LibraryNoteMetaInfoSchema>;
