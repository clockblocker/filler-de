import type { Codecs } from "@textfresser/library-core/codecs";
import type { Healer } from "@textfresser/library-core/healing";
import {
	type CodexAction,
	type CodexImpact,
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	codexImpactToRecreations,
	mergeCodexImpacts,
} from "@textfresser/library-core/codex";
import type { HealingAction } from "@textfresser/library-core/healing";

export type ProcessCodexImpactsResult = {
	/** Healing actions for codex deletions */
	deletionHealingActions: HealingAction[];
	/** Codex recreation actions */
	codexRecreations: CodexAction[];
};

/**
 * Process codex impacts: merge, compute deletions, compute recreations.
 * Pure function that operates on codex impacts and returns actions.
 *
 * @param impacts - Array of codex impacts to process
 * @param healer - Healer for tree access
 * @param codecs - Codec API
 */
export function processCodexImpacts(
	impacts: CodexImpact[],
	healer: Healer,
	codecs: Codecs,
): ProcessCodexImpactsResult {
	// Merge all impacts
	const mergedImpact = mergeCodexImpacts(impacts);

	// Compute deletions
	const deletionHealingActions = codexImpactToDeletions(
		mergedImpact,
		healer,
		codecs,
	);

	// Generate codex recreations (incremental - only impacted sections)
	const codexRecreations = codexImpactToIncrementalRecreations(
		mergedImpact,
		healer,
		codecs,
	);

	return { codexRecreations, deletionHealingActions };
}

/**
 * Process codex impacts for init: uses full recreations instead of incremental.
 */
export function processCodexImpactsForInit(
	impacts: CodexImpact[],
	healer: Healer,
	codecs: Codecs,
): ProcessCodexImpactsResult {
	// Merge all impacts
	const mergedImpact = mergeCodexImpacts(impacts);

	// Compute deletions
	const deletionHealingActions = codexImpactToDeletions(
		mergedImpact,
		healer,
		codecs,
	);

	// Generate full codex recreations (for init)
	const codexRecreations = codexImpactToRecreations(
		mergedImpact,
		healer,
		codecs,
	);

	return { codexRecreations, deletionHealingActions };
}
