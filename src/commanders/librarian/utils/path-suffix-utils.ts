import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	CoreName,
	CoreNameChainFromRoot,
	SplitSuffix,
} from "../types/split-basename";

/** @deprecated */
export function computeSuffixFromPathDepreacated(
	coreNameChain: CoreNameChainFromRoot,
): SplitSuffix {
	return [...coreNameChain].reverse();
}

/** @deprecated */
export function computePathPartsFromSuffixDepreacated(
	splitSuffix: SplitSuffix,
): CoreNameChainFromRoot {
	return [...splitSuffix].reverse();
}

/** @deprecated */
export function buildBasenameDepreacated(
	coreName: CoreName,
	splitSuffix: SplitSuffix,
): string {
	if (splitSuffix.length === 0) {
		return coreName;
	}
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return [coreName, ...splitSuffix].join(suffixDelimiter);
}

/** @deprecated */
export function buildCanonicalBasenameDeprecated(
	coreName: CoreName,
	coreNameChain: CoreNameChainFromRoot,
): string {
	const suffix = computeSuffixFromPathDepreacated(coreNameChain);
	return buildBasenameDepreacated(coreName, suffix);
}

/** @deprecated */
export function suffixMatchesPathDepreacated(
	splitSuffix: SplitSuffix,
	coreNameChain: CoreNameChainFromRoot,
): boolean {
	if (splitSuffix.length !== coreNameChain.length) {
		return false;
	}
	const expectedSuffix = computeSuffixFromPathDepreacated(coreNameChain);
	return splitSuffix.every((s, i) => s === expectedSuffix[i]);
}

/** @deprecated */
export function sanitizeFolderNameDepreacated(name: string): string {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return name.split(suffixDelimiter).join("_");
}

/** @deprecated */
export function folderNameNeedsSanitizationDepreacated(name: string): boolean {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return name.includes(suffixDelimiter);
}

/** @deprecated */
export function pathPartsHaveSuffixDepreacated(pathParts: string[]): boolean {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return pathParts.some((part) => part.includes(suffixDelimiter));
}

/** @deprecated */
export function expandSuffixedPathDepreacated(pathParts: string[]): string[] {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return pathParts.flatMap((part) => part.split(suffixDelimiter));
}
