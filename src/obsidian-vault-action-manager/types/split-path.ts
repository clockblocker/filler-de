import { z } from "zod";

export const CoreSplitPathSchema = z.object({
	basename: z.string(),
	pathParts: z.array(z.string()),
});

const SplitPathTypeSchema = z.enum(["Folder", "File", "MdFile"]);
const SplitPathType = SplitPathTypeSchema.enum;

const SplitPathToFolderSchema = CoreSplitPathSchema.extend({
	type: z.literal(SplitPathType.Folder),
});

const SplitPathToFileSchema = CoreSplitPathSchema.extend({
	extension: z.string(),
	type: z.literal(SplitPathType.File),
});

const SplitPathToMdFileSchema = CoreSplitPathSchema.extend({
	extension: z.literal("md"),
	type: z.literal(SplitPathType.MdFile),
});

const SplitPathSchema = z.discriminatedUnion("type", [
	SplitPathToFolderSchema,
	SplitPathToFileSchema,
	SplitPathToMdFileSchema,
]);

export type CoreSplitPath = z.infer<typeof CoreSplitPathSchema>;

export type SplitPathToFolder = z.infer<typeof SplitPathToFolderSchema>;
export type SplitPathToFile = z.infer<typeof SplitPathToFileSchema>;
export type SplitPathToMdFile = z.infer<typeof SplitPathToMdFileSchema>;

export type SplitPath = z.infer<typeof SplitPathSchema>;
