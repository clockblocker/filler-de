import { getState } from "../../../global-state/global-state";
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
	const state = getState();
	const settings = state.parsedUserSettings;
	const libraryRootPath =
		settings.splitPathToLibraryRoot.pathParts.length > 0
			? `${settings.splitPathToLibraryRoot.pathParts.join("/")}/${settings.splitPathToLibraryRoot.basename}`
			: settings.splitPathToLibraryRoot.basename;
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
	const state = getState();
	const settings = state.parsedUserSettings;
	const libraryRootPath =
		settings.splitPathToLibraryRoot.pathParts.length > 0
			? `${settings.splitPathToLibraryRoot.pathParts.join("/")}/${settings.splitPathToLibraryRoot.basename}`
			: settings.splitPathToLibraryRoot.basename;
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
	const state = getState();
	const settings = state.parsedUserSettings;
	return buildCanonicalBasename(
		leaf.coreName,
		leaf.coreNameChainToParent,
		settings.suffixDelimiter,
	);
}
