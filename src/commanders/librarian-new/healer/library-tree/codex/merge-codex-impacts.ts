/**
 * Merge multiple CodexImpact objects into one.
 */

import type {
	CodexImpact,
	DescendantsStatusChange,
} from "./compute-codex-impact";
import { dedupeChains } from "./section-chain-utils";

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

	// Dedupe chains
	merged.contentChanged = dedupeChains(merged.contentChanged);
	merged.deleted = dedupeChains(merged.deleted);
	merged.descendantsChanged = dedupeDescendantsChanged(
		merged.descendantsChanged,
	);
	merged.renamed = dedupeRenamedChains(merged.renamed);

	return merged;
}

function dedupeRenamedChains(
	renamed: CodexImpact["renamed"],
): CodexImpact["renamed"] {
	const seen = new Set<string>();
	const result: CodexImpact["renamed"] = [];

	for (const r of renamed) {
		const key = r.oldChain.join("/");
		if (!seen.has(key)) {
			seen.add(key);
			result.push(r);
		}
	}

	return result;
}

function dedupeDescendantsChanged(
	items: DescendantsStatusChange[],
): DescendantsStatusChange[] {
	const seen = new Set<string>();
	const result: DescendantsStatusChange[] = [];

	for (const item of items) {
		const key = item.sectionChain.join("/");
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}

	return result;
}
