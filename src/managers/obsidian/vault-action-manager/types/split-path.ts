import type { Result } from "neverthrow";
import type { TFile, TFolder } from "obsidian";
import { z } from "zod";
import { FILE, FOLDER, MD_FILE, MdSchema } from "./literals";

/**
 * @example
 * // for file "Library/parent/child/NoteName-child-parent.md"
 * ["Library", "parent", "child"]
 */
export const PathPartsSchema = z.array(z.string());
export type PathParts = z.infer<typeof PathPartsSchema>;

/**
 * @example
 * // for file "Library/parent/child/NoteName-child-parent.md"
 * {
 *   basename: "NoteName",
 *   pathParts: ["Library", "parent", "child"],
 * }
 */
export const CoreSplitPathSchema = z.object({
	basename: z.string(),
	pathParts: PathPartsSchema,
});

const SplitPathKindSchema = z.enum([FOLDER, FILE, MD_FILE]);
export const SplitPathKind = SplitPathKindSchema.enum;
export type SplitPathKind = z.infer<typeof SplitPathKindSchema>;

export const SplitPathToFolderSchema = CoreSplitPathSchema.extend({
	type: z.literal(SplitPathKind.Folder),
});

export const SplitPathToFileSchema = CoreSplitPathSchema.extend({
	extension: z.string(),
	type: z.literal(SplitPathKind.File),
});

export const SplitPathToMdFileSchema = CoreSplitPathSchema.extend({
	extension: MdSchema,
	type: z.literal(SplitPathKind.MdFile),
});

export const SplitPathSchema = z.discriminatedUnion("type", [
	SplitPathToFolderSchema,
	SplitPathToFileSchema,
	SplitPathToMdFileSchema,
]);

export type CommonSplitPath = z.infer<typeof CoreSplitPathSchema>;

export type AnySplitPath = z.infer<typeof SplitPathSchema>;

export type SplitPath<T extends SplitPathKind> = Extract<
	AnySplitPath,
	{ type: T }
>;

export type SplitPathToFolder = SplitPath<typeof SplitPathKind.Folder>;
export type SplitPathToFile = SplitPath<typeof SplitPathKind.File>;
export type SplitPathToMdFile = SplitPath<typeof SplitPathKind.MdFile>;

export type SplitPathFromTo<T extends AnySplitPath> = { from: T; to: T };

export type SplitPathToMdFileWithReader = SplitPathToMdFile & {
	read: () => Promise<Result<string, string>>;
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
