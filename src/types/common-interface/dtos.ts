import { z } from 'zod';
import { CODEX, ENTRY, PAGE, TEXT } from '../literals';

export type PathParts = string[];

// PathParts.join('/')/title.md
export type PrettyPath = { pathParts: PathParts; title: string };

export type FileType = z.infer<typeof FileTypeSchema>;
export const FileTypeSchema = z.enum([CODEX, ENTRY, PAGE, TEXT]);
export const FileType = FileTypeSchema.enum;
export const ALL_FILE_TYPES = FileTypeSchema.options;

export const MetaInfoSchema = z.object({
	fileType: FileTypeSchema,
});

export type MetaInfo = z.infer<typeof MetaInfoSchema>;
