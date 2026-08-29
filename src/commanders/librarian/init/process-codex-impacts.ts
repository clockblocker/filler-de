import type { Codecs, Healer, HealingAction } from "@textfresser/library-core";
import {
	type CodexAction,
	type CodexImpact,
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	mergeCodexImpacts,
} from "@textfresser/library-core";

type ProcessCodexImpactsResult = {
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
