import z from "zod/v4";
import { TextStatusLegacySchema } from "../../../types/common-interface/enums";
import { CODEX, ENTRY, SCROLL } from "../../../types/literals";

// export const PageLibraryNoteMetaInfoSchema = z.object({
// 	fileType: z.literal(PAGE),
// 	index: z.int().min(0).max(999),
// 	status: TextStatusLegacySchema,
// });

export const ScrollLibraryNoteMetaInfoSchema = z.object({
	fileType: z.literal(SCROLL),
	status: TextStatusLegacySchema,
});

export const CodexLibraryNoteMetaInfoSchema = z.object({
	fileType: z.literal(CODEX),
	status: TextStatusLegacySchema,
});

// export const UnknownNoteMetaInfoSchema = z.object({
// 	fileType: UnknownSchema,
// 	status: TextStatusLegacySchema.optional(),
// });

export const LibraryNoteMetaInfoSchema = z.discriminatedUnion("fileType", [
	ScrollLibraryNoteMetaInfoSchema,
	CodexLibraryNoteMetaInfoSchema,
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
