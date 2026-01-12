import type { CommonSplitPath } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Prettify } from "../../../../../types/helpers";
import type { SeparatedSuffixedBasename } from "../../internal/suffix/types";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../split-path-inside-library";

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
 */
export type CanonicalSplitPathInsideLibrary =
	| CanonicalSplitPathToFolderInsideLibrary
	| CanonicalSplitPathToFileInsideLibrary
	| CanonicalSplitPathToMdFileInsideLibrary;

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

export type MakeCanonical<SP extends CommonSplitPath> = Prettify<
	Omit<SP, "basename"> & CanonicalSeparatedSuffixedBasename
>;

export type CanonicalSplitPathToFolderInsideLibrary =
	MakeCanonical<SplitPathToFolderInsideLibrary>;

export type CanonicalSplitPathToFileInsideLibrary =
	MakeCanonical<SplitPathToFileInsideLibrary>;

export type CanonicalSplitPathToMdFileInsideLibrary =
	MakeCanonical<SplitPathToMdFileInsideLibrary>;
