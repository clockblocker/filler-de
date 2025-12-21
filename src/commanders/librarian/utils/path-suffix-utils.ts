import { getParsedUserSettings } from "../../../global-state/global-state";
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
 * computePathPartsFromSuffix(["child", "parent"]) // ["parent", "child"]
 */
export function computePathPartsFromSuffix(
	splitSuffix: SplitSuffix,
): CoreNameChainFromRoot {
	return [...splitSuffix].reverse();
}

/**
 * Build full basename from coreName and suffix.
 * Reads suffixDelimiter from global settings.
 *
 * @example
 * buildBasename("Note", ["child", "parent"]) // "Note-child-parent"
 */
export function buildBasename(
	coreName: CoreName,
	splitSuffix: SplitSuffix,
): string {
	if (splitSuffix.length === 0) {
		return coreName;
	}
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return [coreName, ...splitSuffix].join(suffixDelimiter);
}

/**
 * Build canonical basename for a file at given path.
 * Reads suffixDelimiter from global settings.
 *
 * @example
 * buildCanonicalBasename("Note", ["parent", "child"]) // "Note-child-parent"
 */
export function buildCanonicalBasename(
	coreName: CoreName,
	coreNameChain: CoreNameChainFromRoot,
): string {
	const suffix = computeSuffixFromPath(coreNameChain);
	return buildBasename(coreName, suffix);
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
 * Reads suffixDelimiter from global settings.
 *
 * @example
 * sanitizeFolderName("my-folder") // "my_folder"
 */
export function sanitizeFolderName(name: string): string {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return name.split(suffixDelimiter).join("_");
}

/**
 * Check if folder name contains the delimiter (needs sanitization).
 * Reads suffixDelimiter from global settings.
 */
export function folderNameNeedsSanitization(name: string): boolean {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return name.includes(suffixDelimiter);
}

/**
 * Check if any path part contains the suffix delimiter.
 * Reads suffixDelimiter from global settings.
 *
 * @example
 * pathPartsHaveSuffix(["Library", "X-Y", "Z"]) // true
 * pathPartsHaveSuffix(["Library", "X", "Y"]) // false
 */
export function pathPartsHaveSuffix(pathParts: string[]): boolean {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return pathParts.some((part) => part.includes(suffixDelimiter));
}

/**
 * Expand path parts by splitting any suffixed segments.
 * Reads suffixDelimiter from global settings.
 * e.g. ["Library", "X-Y"] → ["Library", "X", "Y"]
 *
 * @example
 * expandSuffixedPath(["Library", "X-Y"]) // ["Library", "X", "Y"]
 * expandSuffixedPath(["A", "B-C-D"]) // ["A", "B", "C", "D"]
 */
export function expandSuffixedPath(pathParts: string[]): string[] {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return pathParts.flatMap((part) => part.split(suffixDelimiter));
}
