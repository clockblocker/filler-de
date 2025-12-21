import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { TreeLeaf } from "../types/tree-leaf";
import { buildCanonicalBasename } from "./path-suffix-utils";

/**
 * Join path parts with "/".
 * Filters out empty strings.
 *
 * @example
 * joinPathParts(["a", "b", "c"]) // "a/b/c"
 * joinPathParts(["a", "", "c"]) // "a/c"
 */
export function joinPathParts(parts: string[]): string {
	return parts.filter(Boolean).join("/");
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
			? `${joinPathParts(leaf.coreNameChainToParent)}/`
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
