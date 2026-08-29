import { z } from "zod";
import {
	CODEX,
	ENTRY,
	PAGE,
	SCROLL,
	UNKNOWN,
} from "../literals/infrastructure";

const LibraryMdFileSubTypeSchema = z.enum([CODEX, PAGE, SCROLL, UNKNOWN]);

export const MdFileSubTypeSchema = z.enum([
	ENTRY,
	...LibraryMdFileSubTypeSchema.options,
]);

export const FileType = MdFileSubTypeSchema.enum;
export type FileType = z.infer<typeof MdFileSubTypeSchema>;

