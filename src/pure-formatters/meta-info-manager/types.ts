import { z } from 'zod';
import { TEXT_ROOT, ENTRIE, NOTE, ROOT, PAGE } from '../../types/beta/literals';

export type FileType = z.infer<typeof FileTypeSchema>;
export const FileTypeSchema = z.enum([PAGE, ENTRIE, NOTE, ROOT, TEXT_ROOT]);
export const FileType = FileTypeSchema.enum;
export const ALL_FILE_TYPES = FileTypeSchema.options;

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
