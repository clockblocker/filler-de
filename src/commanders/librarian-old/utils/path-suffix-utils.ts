import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	NodeNameChainDeprecated,
	NodeNameDeprecated,
	SplitSuffixDeprecated,
} from "../types/schemas/node-name";

/** @deprecated */
export function computeSuffixFromPathDepreacated(
	nodeNameChain: NodeNameChainDeprecated,
): SplitSuffixDeprecated {
	return [...nodeNameChain].reverse();
}

/** @deprecated */
export function computePathPartsFromSuffixDepreacated(
	splitSuffix: SplitSuffixDeprecated,
): NodeNameChainDeprecated {
	return [...splitSuffix].reverse();
}

/** @deprecated */
export function buildBasenameDepreacated(
	nodeName: NodeNameDeprecated,
	splitSuffix: SplitSuffixDeprecated,
): string {
	if (splitSuffix.length === 0) {
		return nodeName;
	}
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	return [nodeName, ...splitSuffix].join(suffixDelimiter);
}

/** @deprecated */
export function buildCanonicalBasenameDeprecated(
	nodeName: NodeNameDeprecated,
	nodeNameChain: NodeNameChainDeprecated,
): string {
	const suffix = computeSuffixFromPathDepreacated(nodeNameChain);
	return buildBasenameDepreacated(nodeName, suffix);
}

/** @deprecated */
export function suffixMatchesPathDepreacated(
	splitSuffix: SplitSuffixDeprecated,
	nodeNameChain: NodeNameChainDeprecated,
): boolean {
	if (splitSuffix.length !== nodeNameChain.length) {
		return false;
	}
	const expectedSuffix = computeSuffixFromPathDepreacated(nodeNameChain);
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
