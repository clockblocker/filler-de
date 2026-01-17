import type { Codecs } from "../codecs";
import type { Healer } from "../healer/healer";
import {
	type CodexImpact,
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	codexImpactToRecreations,
} from "../healer/library-tree/codex";
import { mergeCodexImpacts } from "../healer/library-tree/codex/merge-codex-impacts";
import type { CodexAction } from "../healer/library-tree/codex/types/codex-action";
import type { HealingAction } from "../healer/library-tree/types/healing-action";

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

	return { deletionHealingActions, codexRecreations };
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

	return { deletionHealingActions, codexRecreations };
}
