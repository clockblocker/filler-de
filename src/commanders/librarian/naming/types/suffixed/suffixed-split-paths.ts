import z from "zod";
import {
	SplitPathToFileSchema,
	SplitPathToFolderSchema,
	SplitPathToMdFileSchema,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	JoinedSuffixedBasenameForFileSchema,
	JoinedSuffixedBasenameForFolderSchema,
} from "./joined-suffixed";

const SuffixedSplitPathToFolderSchema = SplitPathToFolderSchema.omit({
	basename: true,
}).extend({
	basename: JoinedSuffixedBasenameForFolderSchema,
});

const SuffixedSplitPathToFileSchema = SplitPathToFileSchema.omit({
	basename: true,
}).extend({
	basename: JoinedSuffixedBasenameForFileSchema,
});

const SuffixedSplitPathToMdFileSchema = SplitPathToMdFileSchema.omit({
	basename: true,
}).extend({
	basename: JoinedSuffixedBasenameForFileSchema,
});

export const SuffixedSplitPathSchema = z.discriminatedUnion("type", [
	SuffixedSplitPathToFolderSchema,
	SuffixedSplitPathToFileSchema,
	SuffixedSplitPathToMdFileSchema,
]);

export type SuffixedSplitPathToFolder = z.infer<
	typeof SuffixedSplitPathToFolderSchema
>;
export type SuffixedSplitPathToFile = z.infer<
	typeof SuffixedSplitPathToFileSchema
>;
export type SuffixedSplitPathToMdFile = z.infer<
	typeof SuffixedSplitPathToMdFileSchema
>;
export type SuffixedSplitPath = z.infer<typeof SuffixedSplitPathSchema>;
