import type { TFile, TFolder } from "obsidian";
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

export type SplitPathToMdFileWithReader = SplitPathToMdFile & {
	read: () => Promise<string>;
};

export type SplitPathWithReader = SplitPathToMdFileWithReader | SplitPathToFile;

/**
 * @internal
 * tRef types are internal to the manager - tRefs become stale and should not leave the manager.
 * Use SplitPathWithReader instead for external code.
 * These are exported only for internal manager use (reader.ts, facade.ts).
 */
export type SplitPathToFolderWithTRef = SplitPathToFolder & { tRef: TFolder };
export type SplitPathToFileWithTRef = SplitPathToFile & { tRef: TFile };
export type SplitPathToMdFileWithTRef = SplitPathToMdFile & { tRef: TFile };

/**
 * @internal
 * Internal type for manager use only. External code should use SplitPathWithReader.
 */
export type SplitPathWithTRef =
	| SplitPathToFolderWithTRef
	| SplitPathToFileWithTRef
	| SplitPathToMdFileWithTRef;
