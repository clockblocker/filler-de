import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { TreeLeaf } from "../types/tree-leaf";
import { buildCanonicalBasename } from "./path-suffix-utils";

/**
 * Build basic path from tree leaf (no suffix in basename).
 * Path format: libraryRoot/pathChain/coreName.extension
 *
 * @example
 * given settings: { splitPathToLibraryRoot: { basename: "Library", pathParts: [], type: "Folder" } }
 * buildPathFromTree({ coreName: "Note", coreNameChainToParent: ["A", "B"], extension: "md" })
 * // "Library/A/B/Note.md"
 * @example
 * given settings: { splitPathToLibraryRoot: { basename: "child", pathParts: ["parent"], type: "Folder" } }
 * buildPathFromTree({ coreName: "Note", coreNameChainToParent: ["A", "B"], extension: "md" })
 * // "parent/child/A/B/Note.md"
 */
export function buildPathFromTree(leaf: TreeLeaf): string {
	const settings = getParsedUserSettings();
	const libraryRootPath = makeSystemPathForSplitPath(
		settings.splitPathToLibraryRoot,
	);

	const pathChain =
		leaf.coreNameChainToParent.length > 0
			? `${leaf.coreNameChainToParent.join("/")}/`
			: "";

	return `${libraryRootPath}/${pathChain}${leaf.coreName}.${leaf.extension}`;
}

/**
 * Build canonical path from tree leaf (with suffix in basename).
 * Path format: libraryRoot/pathChain/canonicalBasename.extension
 *
 * @example
 * buildCanonicalPathFromTree({ coreName: "Note", coreNameChainToParent: ["A", "B"], extension: "md" })
 * // "Library/A/B/Note-B-A.md"
 */
export function buildCanonicalPathFromTree(leaf: TreeLeaf): string {
	const settings = getParsedUserSettings();
	const libraryRootPath = makeSystemPathForSplitPath(
		settings.splitPathToLibraryRoot,
	);

	const canonicalBasename = buildCanonicalBasename(
		leaf.coreName,
		leaf.coreNameChainToParent,
		settings.suffixDelimiter,
	);

	const pathChain =
		leaf.coreNameChainToParent.length > 0
			? `${leaf.coreNameChainToParent.join("/")}/`
			: "";
	return `${libraryRootPath}/${pathChain}${canonicalBasename}.${leaf.extension}`;
}

/**
 * Build canonical basename from tree leaf (with suffix).
 *
 * @example
 * buildCanonicalBasenameFromTree({ coreName: "Note", coreNameChainToParent: ["A", "B"] })
 * // "Note-B-A"
 */
export function buildCanonicalBasenameFromTree(leaf: TreeLeaf): string {
	const settings = getParsedUserSettings();
	return buildCanonicalBasename(
		leaf.coreName,
		leaf.coreNameChainToParent,
		settings.suffixDelimiter,
	);
}
