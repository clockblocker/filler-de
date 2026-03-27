/**
 * Merge multiple CodexImpact objects into one.
 */

import type {
	CodexImpact,
	DescendantsStatusChange,
} from "./compute-codex-impact";
import { chainToKey, dedupeByKey, dedupeChains } from "./section-chain-utils";

/**
 * Merge multiple CodexImpact objects, deduplicating chains.
 */
export function mergeCodexImpacts(impacts: CodexImpact[]): CodexImpact {
	const merged: CodexImpact = {
		contentChanged: [],
		deleted: [],
		descendantsChanged: [],
		impactedChains: new Set(),
		renamed: [],
	};

	for (const impact of impacts) {
		merged.contentChanged.push(...impact.contentChanged);
		merged.deleted.push(...impact.deleted);
		merged.descendantsChanged.push(...impact.descendantsChanged);
		merged.renamed.push(...impact.renamed);
		// Merge impactedChains Sets
		for (const chain of impact.impactedChains) {
			merged.impactedChains.add(chain);
		}
	}

	// Dedupe using generic dedupeByKey
	merged.contentChanged = dedupeChains(merged.contentChanged);
	merged.deleted = dedupeChains(merged.deleted);
	merged.descendantsChanged = dedupeByKey(
		merged.descendantsChanged,
		(d: DescendantsStatusChange) => chainToKey(d.sectionChain),
	);
	merged.renamed = dedupeByKey(merged.renamed, (r) => chainToKey(r.oldChain));

	return merged;
}
