import { z } from "zod";

export const CoreSplitPathSchema = z.object({
	basename: z.string(),
	pathParts: z.array(z.string()),
});

const SplitPathTypeSchema = z.enum(["Folder", "File", "MdFile"]);
const SplitPathType = SplitPathTypeSchema.enum;

const FolderSplitPathSchema = CoreSplitPathSchema.extend({
	type: z.literal(SplitPathType.Folder),
});

const FileSplitPathSchema = CoreSplitPathSchema.extend({
	extension: z.string(),
	type: z.literal(SplitPathType.File),
});

const MdFileSplitPathSchema = CoreSplitPathSchema.extend({
	extension: z.literal("md"),
	type: z.literal(SplitPathType.MdFile),
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
