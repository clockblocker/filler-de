import type {
	CoreName,
	CoreNameChainFromRoot,
	SplitSuffix,
} from "../types/split-basename";

/**
 * Compute suffix from path parts.
 * Path parts are reversed to form suffix (child-to-root order).
 *
 * @example
 * computeSuffixFromPath(["parent", "child"]) // ["child", "parent"]
 */
export function computeSuffixFromPath(
	coreNameChain: CoreNameChainFromRoot,
): SplitSuffix {
	return [...coreNameChain].reverse();
}

/**
 * Compute path from suffix.
 * Suffix is reversed to form path parts (root-to-child order).
 *
 * @example
 * computePathFromSuffix(["child", "parent"]) // ["parent", "child"]
 */
export function computePathFromSuffix(
	splitSuffix: SplitSuffix,
): CoreNameChainFromRoot {
	return [...splitSuffix].reverse();
}

/**
 * Build full basename from coreName and suffix.
 *
 * @example
 * buildBasename("Note", ["child", "parent"], "-") // "Note-child-parent"
 */
export function buildBasename(
	coreName: CoreName,
	splitSuffix: SplitSuffix,
	suffixDelimiter = "-",
): string {
	if (splitSuffix.length === 0) {
		return coreName;
	}
	return [coreName, ...splitSuffix].join(suffixDelimiter);
}

/**
 * Build canonical basename for a file at given path.
 *
 * @example
 * buildCanonicalBasename("Note", ["parent", "child"], "-") // "Note-child-parent"
 */
export function buildCanonicalBasename(
	coreName: CoreName,
	coreNameChain: CoreNameChainFromRoot,
	suffixDelimiter = "-",
): string {
	const suffix = computeSuffixFromPath(coreNameChain);
	return buildBasename(coreName, suffix, suffixDelimiter);
}

/**
 * Check if suffix matches path (accounting for reversal).
 */
export function suffixMatchesPath(
	splitSuffix: SplitSuffix,
	coreNameChain: CoreNameChainFromRoot,
): boolean {
	if (splitSuffix.length !== coreNameChain.length) {
		return false;
	}
	const expectedSuffix = computeSuffixFromPath(coreNameChain);
	return splitSuffix.every((s, i) => s === expectedSuffix[i]);
}

/**
 * Sanitize folder name by replacing delimiter with underscore.
 *
 * @example
 * sanitizeFolderName("my-folder", "-") // "my_folder"
 */
export function sanitizeFolderName(
	name: string,
	suffixDelimiter = "-",
): string {
	return name.split(suffixDelimiter).join("_");
}

/**
 * Check if folder name contains the delimiter (needs sanitization).
 */
export function folderNameNeedsSanitization(
	name: string,
	suffixDelimiter = "-",
): boolean {
	return name.includes(suffixDelimiter);
}

/**
 * Check if any path part contains the suffix delimiter.
 *
 * @example
 * pathPartsHaveSuffix(["Library", "X-Y", "Z"], "-") // true
 * pathPartsHaveSuffix(["Library", "X", "Y"], "-") // false
 */
export function pathPartsHaveSuffix(
	pathParts: string[],
	suffixDelimiter = "-",
): boolean {
	return pathParts.some((part) => part.includes(suffixDelimiter));
}

/**
 * Expand path parts by splitting any suffixed segments.
 * e.g. ["Library", "X-Y"] → ["Library", "X", "Y"]
 *
 * @example
 * expandSuffixedPath(["Library", "X-Y"], "-") // ["Library", "X", "Y"]
 * expandSuffixedPath(["A", "B-C-D"], "-") // ["A", "B", "C", "D"]
 */
export function expandSuffixedPath(
	pathParts: string[],
	suffixDelimiter = "-",
): string[] {
	return pathParts.flatMap((part) => part.split(suffixDelimiter));
}
