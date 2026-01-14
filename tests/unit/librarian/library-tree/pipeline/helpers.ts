/**
 * Test helpers for running the full pipeline:
 * BulkVaultEvent → TreeActions → Healer → CodexImpact → Deletions → Recreations → HealingActions
 */

import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../src/commanders/librarian-new/codecs";
import type { Healer } from "../../../../../src/commanders/librarian-new/healer/healer";
import {
	codexImpactToDeletions,
	codexImpactToRecreations,
	extractInvalidCodexesFromBulk,
	type TreeAccessor,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions";
import type { CodexImpact } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/compute-codex-impact";
import { mergeCodexImpacts } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/merge-codex-impacts";
import type { CodexAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/types/codex-action";
import { buildTreeActions } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/index";
import type { CreateTreeLeafAction, TreeAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import type { HealingAction } from "../../../../../src/commanders/librarian-new/healer/library-tree/types/healing-action";
import type { BulkVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";
import { makeTree, type TreeShape } from "../tree-test-helpers";

// ─── Pipeline Result ───

export type PipelineResult = {
	treeActions: TreeAction[];
	codexImpacts: CodexImpact[];
	mergedCodexImpact: CodexImpact;
	deletionActions: HealingAction[];
	recreationActions: CodexAction[];
	healingActions: HealingAction[];
	healer: Healer;
};

// ─── Persistent Pipeline State ───

export type PersistentPipelineState = {
	healer: Healer;
	codecs: Codecs;
	rules: CodecRules;
	history: PipelineResult[];
};

// ─── Main Pipeline Runner ───

/**
 * Run full pipeline: BulkVaultEvent → TreeActions → Healer → CodexImpact → Deletions → Recreations
 * Creates a new healer instance (for single-event tests).
 */
export function runPipeline(
	initialTree: TreeShape,
	bulkEvent: BulkVaultEvent,
): PipelineResult {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	const healer = makeTree(initialTree);

	return processBulkEvent({ codecs, healer, rules }, bulkEvent);
}

/**
 * Create a persistent pipeline state for sequential event testing.
 * The same healer instance is used across multiple events.
 */
export function createPersistentPipeline(
	initialTree: TreeShape,
): PersistentPipelineState {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	const healer = makeTree(initialTree);

	return {
		codecs,
		healer,
		history: [],
		rules,
	};
}

/**
 * Process a bulk event on a persistent pipeline state.
 * Mutates the healer's tree state and records the result in history.
 */
export function processBulkEvent(
	state: PersistentPipelineState | { healer: Healer; codecs: Codecs; rules: CodecRules },
	bulkEvent: BulkVaultEvent,
): PipelineResult {
	const { healer, codecs, rules } = state;

	// Normalize bulk event to ensure required fields exist
	const normalizedBulk: BulkVaultEvent = {
		...bulkEvent,
		debug: bulkEvent.debug ?? {
			collapsedCount: { creates: 0, deletes: 0, renames: 0 },
			endedAt: 0,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 0,
			trueCount: { creates: 0, deletes: 0, renames: 0 },
		},
		events: bulkEvent.events ?? [],
		roots: bulkEvent.roots ?? [],
	};

	// Step 1: Build tree actions from bulk event
	const treeActions = buildTreeActions(normalizedBulk, codecs, rules);

	// Step 2: Process each action through healer (mutates tree state)
	const codexImpacts: CodexImpact[] = [];
	const healingActions: HealingAction[] = [];

	for (const action of treeActions) {
		const result = healer.getHealingActionsFor(action);
		codexImpacts.push(result.codexImpact);
		healingActions.push(...result.healingActions);
	}

	// Step 3: Merge codex impacts
	const mergedCodexImpact = mergeCodexImpacts(codexImpacts);

	// Step 4: Extract invalid codexes from bulk event (after tree state updated)
	const invalidCodexDeletions = extractInvalidCodexesFromBulk(
		normalizedBulk,
		codecs,
	);

	// Step 5: Convert codex deletions to healing actions (merge with invalid codexes)
	const codexImpactDeletions = codexImpactToDeletions(
		mergedCodexImpact,
		healer,
		codecs,
	);
	const deletionActions = [...invalidCodexDeletions, ...codexImpactDeletions];

	// Step 6: Convert codex recreations to codex actions
	const recreationActions = codexImpactToRecreations(
		mergedCodexImpact,
		healer,
		codecs,
	);

	const result: PipelineResult = {
		codexImpacts,
		deletionActions,
		healer,
		healingActions,
		mergedCodexImpact,
		recreationActions,
		treeActions,
	};

	// Record in history if using PersistentPipelineState
	if ("history" in state) {
		state.history.push(result);
	}

	return result;
}

/**
 * Initialize pipeline from logged createActions (from Obsidian init).
 * Applies all create actions to build the initial tree state.
 */
export function createPipelineFromCreateActions(
	createActions: CreateTreeLeafAction[],
): PersistentPipelineState {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	
	// Create empty tree
	const libraryRoot = "Library" as const;
	const healer = makeTree({ libraryRoot });

	// Apply all create actions to build initial tree state
	const codexImpacts: CodexImpact[] = [];
	for (const action of createActions) {
		const result = healer.getHealingActionsFor(action);
		codexImpacts.push(result.codexImpact);
	}

	return {
		codecs,
		healer,
		history: [],
		rules,
	};
}
