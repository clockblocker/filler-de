import { z } from "zod";

export const CoreSplitPathSchema = z.object({
	basename: z.string(),
	pathParts: z.array(z.string()),
});

const SplitPathTypeSchema = z.enum(["Folder", "File", "MdFile"]);
const SplitPathType = SplitPathTypeSchema.enum;

const FolderSplitPathSchema = CoreSplitPathSchema.extend({
	type: SplitPathType.Folder,
});

const FileSplitPathSchema = FolderSplitPathSchema.extend({
	extension: z.string(),
	type: SplitPathType.File,
});

const MdFileSplitPathSchema = FileSplitPathSchema.extend({
	extension: z.literal("md"),
	type: SplitPathType.MdFile,
});

const SplitPathSchema = z.discriminatedUnion("type", [
	FolderSplitPathSchema,
	FileSplitPathSchema,
	MdFileSplitPathSchema,
]);

export type CoreSplitPath = z.infer<typeof CoreSplitPathSchema>;

export type FolderSplitPath = z.infer<typeof FolderSplitPathSchema>;
export type FileSplitPath = z.infer<typeof FileSplitPathSchema>;
export type MdFileSplitPath = z.infer<typeof MdFileSplitPathSchema>;

export type SplitPath = z.infer<typeof SplitPathSchema>;
