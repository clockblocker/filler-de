import z from "zod";
import {
	LibraryMdFileSubTypeSchema,
	TextStatusSchema,
} from "../../../types/common-interface/enums";
import { ENTRY } from "../../../types/literals";

export const LibraryNoteMetaInfoSchema = z.object({
	fileType: LibraryMdFileSubTypeSchema,
	status: TextStatusSchema,
});

export const LinguisticNoteMetaInfoSchema = z.object({
	fileType: z.literal(ENTRY),
});

export const MetaInfoSchema = z.discriminatedUnion("fileType", [
	LibraryNoteMetaInfoSchema,
	LinguisticNoteMetaInfoSchema,
]);

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
export type LibraryNoteMetaInfo = z.infer<typeof LibraryNoteMetaInfoSchema>;
