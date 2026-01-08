/**
 * Utilities for working with section chains in codex generation.
 */

import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";

/**
 * Expand a section chain to include all ancestor prefixes.
 * ["Lib", "A", "B"] → [[], ["Lib"], ["Lib", "A"], ["Lib", "A", "B"]]
 */
export function expandToAncestors(
	chain: SectionNodeSegmentId[],
): SectionNodeSegmentId[][] {
	const result: SectionNodeSegmentId[][] = [[]];

	for (let i = 1; i <= chain.length; i++) {
		result.push(chain.slice(0, i));
	}

	return result;
}

/**
 * Deduplicate chains by string key.
 * Preserves first occurrence order.
 */
export function dedupeChains(
	chains: SectionNodeSegmentId[][],
): SectionNodeSegmentId[][] {
	const seen = new Set<string>();
	const result: SectionNodeSegmentId[][] = [];

	for (const chain of chains) {
		const key = chain.join("/");
		if (!seen.has(key)) {
			seen.add(key);
			result.push(chain);
		}
	}

	return result;
}

/**
 * Collect impacted sections: expand all chains to ancestors and dedupe.
 * Filters out empty chains (no codex for root above Library).
 */
export function collectImpactedSections(
	chains: SectionNodeSegmentId[][],
): SectionNodeSegmentId[][] {
	if (chains.length === 0) return [];

	const expanded: SectionNodeSegmentId[][] = [];
	for (const chain of chains) {
		expanded.push(...expandToAncestors(chain));
	}

	// Filter out empty chains (no section above Library root)
	const nonEmpty = expanded.filter((chain) => chain.length > 0);

	return dedupeChains(nonEmpty);
}
