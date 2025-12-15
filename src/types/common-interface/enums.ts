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
export const LibraryFileLegacyType = LibraryMdFileSubTypeSchema.enum;
export type LibraryFileLegacyType = z.infer<typeof LibraryMdFileSubTypeSchema>;

export const MdFileSubTypeSchema = z.enum([
	ENTRY,
	...LibraryMdFileSubTypeSchema.options,
]);

export const FileType = MdFileSubTypeSchema.enum;
export type FileType = z.infer<typeof MdFileSubTypeSchema>;
export const ALL_FILE_TYPES = MdFileSubTypeSchema.options;

export const TextStatusLegacySchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type TextStatusLegacy = z.infer<typeof TextStatusLegacySchema>;
export const TextStatusLegacy = TextStatusLegacySchema.enum;
