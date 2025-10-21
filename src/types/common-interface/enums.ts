import { z } from 'zod';
import { CODEX, ENTRY, PAGE, TEXT, UNKNOWN } from '../literals';

export type FileType = z.infer<typeof FileTypeSchema>;
export const FileTypeSchema = z.enum([CODEX, ENTRY, PAGE, TEXT, UNKNOWN]);
export const FileType = FileTypeSchema.enum;
export const ALL_FILE_TYPES = FileTypeSchema.options;
