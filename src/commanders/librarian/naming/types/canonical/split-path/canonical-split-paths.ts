import z from "zod";
import {
	SplitPathToFileSchema,
	SplitPathToFolderSchema,
	SplitPathToMdFileSchema,
} from "../../../../../../obsidian-vault-action-manager/types/split-path";
import {
	JoinedCanonicalBasenameForFileSchema,
	JoinedCanonicalBasenameForFolderSchema,
} from "../joined-canonical";

const CanonicalSplitPathToFolderSchema = SplitPathToFolderSchema.omit({
	basename: true,
}).extend({
	basename: JoinedCanonicalBasenameForFolderSchema,
});

const CanonicalSplitPathToFileSchema = SplitPathToFileSchema.omit({
	basename: true,
}).extend({
	basename: JoinedCanonicalBasenameForFileSchema,
});

const CanonicalSplitPathToMdFileSchema = SplitPathToMdFileSchema.omit({
	basename: true,
}).extend({
	basename: JoinedCanonicalBasenameForFileSchema,
});

export const CanonicalSplitPathSchema = z.discriminatedUnion("type", [
	CanonicalSplitPathToFolderSchema,
	CanonicalSplitPathToFileSchema,
	CanonicalSplitPathToMdFileSchema,
]);

export type CanonicalSplitPathToFolder = z.infer<
	typeof CanonicalSplitPathToFolderSchema
>;
export type CanonicalSplitPathToFile = z.infer<
	typeof CanonicalSplitPathToFileSchema
>;
export type CanonicalSplitPathToMdFile = z.infer<
	typeof CanonicalSplitPathToMdFileSchema
>;
export type CanonicalSplitPath = z.infer<typeof CanonicalSplitPathSchema>;
