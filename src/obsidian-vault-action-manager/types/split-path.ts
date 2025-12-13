import { z } from "zod";
import { FILE, FOLDER, MD_FILE, MdSchema } from "./literals";

export const CoreSplitPathSchema = z.object({
	basename: z.string(),
	pathParts: z.array(z.string()),
});

const SplitPathTypeSchema = z.enum([FOLDER, FILE, MD_FILE]);
export const SplitPathType = SplitPathTypeSchema.enum;
export type SplitPathType = z.infer<typeof SplitPathTypeSchema>;

const SplitPathToFolderSchema = CoreSplitPathSchema.extend({
	type: z.literal(SplitPathType.Folder),
});

const SplitPathToFileSchema = CoreSplitPathSchema.extend({
	extension: z.string(),
	type: z.literal(SplitPathType.File),
});

const SplitPathToMdFileSchema = CoreSplitPathSchema.extend({
	extension: MdSchema,
	type: z.literal(SplitPathType.MdFile),
});

export const SplitPathSchema = z.discriminatedUnion("type", [
	SplitPathToFolderSchema,
	SplitPathToFileSchema,
	SplitPathToMdFileSchema,
]);

export type CoreSplitPath = z.infer<typeof CoreSplitPathSchema>;

export type SplitPathToFolder = z.infer<typeof SplitPathToFolderSchema>;
export type SplitPathToFile = z.infer<typeof SplitPathToFileSchema>;
export type SplitPathToMdFile = z.infer<typeof SplitPathToMdFileSchema>;

export type SplitPath = z.infer<typeof SplitPathSchema>;

export type SplitPathFromTo<T extends SplitPath> = { from: T; to: T };
