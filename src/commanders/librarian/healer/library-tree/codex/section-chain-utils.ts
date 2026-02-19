/**
 * Utilities for working with section chains in codex generation.
 */

import { dedupeByKeyFirst as dedupeByKey } from "../../../../../utils/array-utils";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id";

export { dedupeByKey };

// ─── Chain Utilities ───

/**
 * Serialize a chain to a string key for deduplication.
 */
export function chainToKey(chain: SectionNodeSegmentId[]): string {
	return chain.join("/");
}

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
	return dedupeByKey(chains, chainToKey);
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
