/**
 * Utilities for collecting and expanding impacted chains.
 */

import type { NodeNameChain } from "../types/schemas/node-name";
import { joinPathPartsDeprecated } from "../utils/tree-path-utils";

/**
 * Flatten result from applyTreeAction into array of chains.
 * MoveNode returns [oldParent, newParent], others return single chain.
 */
export function flattenActionResult(
	result: NodeNameChain | [NodeNameChain, NodeNameChain],
): NodeNameChain[] {
	if (Array.isArray(result[0])) {
		// It's a tuple of two chains
		return result as NodeNameChain[];
	}
	// It's a single chain
	return [result as NodeNameChain];
}

/**
 * Expand chains to include all ancestors (including root).
 * ["A", "B", "C"] → [[], ["A"], ["A", "B"], ["A", "B", "C"]]
 */
export function expandToAncestors(chain: NodeNameChain): NodeNameChain[] {
	const result: NodeNameChain[] = [[]]; // Start with root

	for (let i = 1; i <= chain.length; i++) {
		result.push(chain.slice(0, i));
	}

	return result;
}

/**
 * Expand multiple chains to include all ancestors.
 */
export function expandAllToAncestors(chains: NodeNameChain[]): NodeNameChain[] {
	const result: NodeNameChain[] = [];

	for (const chain of chains) {
		result.push(...expandToAncestors(chain));
	}

	return result;
}

/**
 * Deduplicate chains by converting to string keys.
 */
export function dedupeChains(chains: NodeNameChain[]): NodeNameChain[] {
	const seen = new Set<string>();
	const result: NodeNameChain[] = [];

	for (const chain of chains) {
		const key = joinPathPartsDeprecated(chain);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(chain);
		}
	}

	return result;
}

/**
 * Collect impacted chains from action results, expand ancestors, and dedupe.
 */
export function collectImpactedSections(
	actionResults: Array<NodeNameChain | [NodeNameChain, NodeNameChain]>,
): NodeNameChain[] {
	// Flatten all results
	const allChains: NodeNameChain[] = [];
	for (const result of actionResults) {
		const flattened = flattenActionResult(result);
		allChains.push(...flattened);
	}

	// Expand to ancestors and dedupe
	const expanded = expandAllToAncestors(allChains);
	const deduped = dedupeChains(expanded);

	// Note: We don't filter out non-section chains here because we don't have tree access.
	// Filtering happens in regenerateCodexes using getNode.

	return deduped;
}

/**
 * Find common ancestor of multiple chains.
 * Returns the longest common prefix.
 */
export function findCommonAncestor(chains: NodeNameChain[]): NodeNameChain {
	const first = chains[0];

	if (!first) {
		return [];
	}

	if (chains.length === 1) {
		return first;
	}

	let commonLength = first.length;

	for (let i = 1; i < chains.length; i++) {
		const other = chains[i];
		if (!other) {
			throw new Error(`Chain ${i} is undefined`);
		}
		let j = 0;
		while (j < commonLength && j < other.length && first[j] === other[j]) {
			j++;
		}
		commonLength = j;
	}

	return first.slice(0, commonLength);
}
