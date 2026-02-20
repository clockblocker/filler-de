import type {
	SplitPathKind,
	SplitPathKind as SplitPathKindEnum,
} from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SeparatedSuffixedBasename } from "../internal/suffix/types";
import type { SplitPathInsideLibraryOf } from "../split-path-inside-library";

/**
 * Split path inside library with separated suffix.
 * Can be non-canonical (suffixParts may not match pathParts).
 */
export type SplitPathInsideLibraryWithSeparatedSuffixOf<
	SK extends SplitPathKind,
> = Omit<SplitPathInsideLibraryOf<SK>, "basename"> & {
	separatedSuffixedBasename: SeparatedSuffixedBasename;
};

/**
 * LibraryTree compliant canonical split path.
 *
 * Library root is excluded from suffixParts.
 * Library root is included in pathParts.
 *
 * @example For files / markdown files:
 * "Library/parent/child/NoteName-child-parent.md"
 * =>
 * {
 *   pathParts: ["Library", "parent", "child"],
 *   extension: "md",
 *   kind: "MdFile",
 *   separatedSuffixedBasename: { coreName: "NoteName", suffixParts: ["child", "parent"] },
 * }
 *
 * @example For folders:
 * "Library/parent/child"
 * =>
 * {
 *   pathParts: ["Library", "parent"],
 *   kind: "Folder",
 *   separatedSuffixedBasename: { coreName: "child", suffixParts: [] },
 * }
 *
 * Semantically validated/canonical version of SplitPathInsideLibraryWithSeparatedSuffixOf.
 * Structure is identical, but this type indicates the path has been validated against canonization policy.
 */
export type CanonicalSplitPathInsideLibraryOf<SK extends SplitPathKind> =
	SplitPathInsideLibraryWithSeparatedSuffixOf<SK>;

// --

/**
 * suffixParts is empty for folders
 *
 * Library root is excluded from suffixParts for files
 *
 */
export type CanonicalSeparatedSuffixedBasename = {
	separatedSuffixedBasename: SeparatedSuffixedBasename;
};

export type CanonicalSplitPathToFolderInsideLibrary =
	SplitPathInsideLibraryWithSeparatedSuffixOf<
		typeof SplitPathKindEnum.Folder
	>;

export type CanonicalSplitPathToFileInsideLibrary =
	SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKindEnum.File>;

export type CanonicalSplitPathToMdFileInsideLibrary =
	SplitPathInsideLibraryWithSeparatedSuffixOf<
		typeof SplitPathKindEnum.MdFile
	>;

export type AnyCanonicalSplitPathInsideLibrary =
	| CanonicalSplitPathToFolderInsideLibrary
	| CanonicalSplitPathToFileInsideLibrary
	| CanonicalSplitPathToMdFileInsideLibrary;
