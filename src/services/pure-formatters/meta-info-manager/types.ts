import { z } from 'zod';
import { CODEX, ENTRY, PAGE, TEXT } from '../../../types/beta/literals';

export type FileType = z.infer<typeof FileTypeSchema>;
export const FileTypeSchema = z.enum([CODEX, ENTRY, PAGE, TEXT]);
export const FileType = FileTypeSchema.enum;
export const ALL_FILE_TYPES = FileTypeSchema.options;

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
