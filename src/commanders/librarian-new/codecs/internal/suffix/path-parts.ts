import type { NodeName } from "../../../types/schemas/node-name";
import type { CodecRules } from "../../rules";

/**
 * Converts pathParts (WITHOUT Library root) to suffixParts (reversed).
 * Use when pathParts does not include Library root.
 */
export function pathPartsToSuffixParts(pathParts: string[]): NodeName[] {
	return [...pathParts].reverse() as NodeName[];
}

/**
 * Converts pathParts (WITH Library root) to suffixParts (WITHOUT root, reversed).
 * Use when pathParts includes Library root as first element.
 */
export function pathPartsWithRootToSuffixParts(
	_rules: CodecRules,
	pathParts: string[],
): NodeName[] {
	// Drop Library root (first element), then reverse
	return pathParts.slice(1).reverse() as NodeName[];
}

/**
 * Converts suffixParts to pathParts (reversed).
 */
export function suffixPartsToPathParts(suffixParts: NodeName[]): string[] {
	return [...suffixParts].reverse();
}
