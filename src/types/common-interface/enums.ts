import { z } from "zod";
import {
	CODEX,
	DONE,
	ENTRY,
	IN_PROGRESS,
	NOT_STARTED,
	PAGE,
	SCROLL,
	UNKNOWN,
} from "../literals";

export const LibraryMdFileSubTypeSchema = z.enum([
	CODEX,
	PAGE,
	SCROLL,
	UNKNOWN,
]);
export const LibraryFileType = LibraryMdFileSubTypeSchema.enum;
export type LibraryFileType = z.infer<typeof LibraryMdFileSubTypeSchema>;

export const MdFileSubTypeSchema = z.enum([
	ENTRY,
	...LibraryMdFileSubTypeSchema.options,
]);

export const FileType = MdFileSubTypeSchema.enum;
export type FileType = z.infer<typeof MdFileSubTypeSchema>;
export const ALL_FILE_TYPES = MdFileSubTypeSchema.options;

export const TextStatusSchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type TextStatus = z.infer<typeof TextStatusSchema>;
export const TextStatus = TextStatusSchema.enum;
