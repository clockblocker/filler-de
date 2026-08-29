/**
 * Test helpers for running the full pipeline:
 * LibraryBulk → TreeActions → Healer → CodexImpact → Deletions → Recreations → HealingActions
 */

import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../src/codecs";
import type { CodexImpact } from "../../../../../src/healer/library-tree/codex/compute-codex-impact";
import { mergeCodexImpacts } from "../../../../../src/healer/library-tree/codex/merge-codex-impacts";
import type { CodexAction } from "../../../../../src/healer/library-tree/codex/types/codex-action";
import {
	type BulkInterpreter,
	makeBulkInterpreter,
} from "../../../../../src/healer/library-tree/tree-action/bulk-vault-action-adapter";
import type {
	CreateTreeLeafAction,
	TreeAction,
} from "../../../../../src/healer/library-tree/tree-action/types/tree-action";
import type { HealingAction } from "../../../../../src/healer/library-tree/types/healing-action";
import type { Healer } from "../../../../../src/healing";
import type { LibraryBulk } from "../../../../../src/tree/library-scope";
import { processCodexImpacts } from "../../../../src/commanders/librarian/init/process-codex-impacts";
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

type PersistentPipelineState = {
	healer: Healer;
	codecs: Codecs;
	interpretBulk: BulkInterpreter;
	rules: CodecRules;
	history: PipelineResult[];
};

// ─── Main Pipeline Runner ───


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
		interpretBulk: makeBulkInterpreter(codecs),
		rules,
	};
}

/**
 * Process a bulk event on a persistent pipeline state.
 * Mutates the healer's tree state and records the result in history.
 */
export function processBulkEvent(
	state:
		| PersistentPipelineState
		| {
				healer: Healer;
				codecs: Codecs;
				interpretBulk: BulkInterpreter;
				rules: CodecRules;
		  },
	bulkEvent: LibraryBulk,
): PipelineResult {
	const { healer, codecs, interpretBulk } = state;

	// Step 1: Interpret the semantic bulk once.
	const { invalidCodexActions, treeActions } = interpretBulk(bulkEvent);

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

	// Step 4: Use the same incremental codex path as Librarian.processActions.
	const {
		codexRecreations: recreationActions,
		deletionHealingActions: codexImpactDeletions,
	} = processCodexImpacts(codexImpacts, healer, codecs);
	const deletionActions = [...invalidCodexActions, ...codexImpactDeletions];

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
		interpretBulk: makeBulkInterpreter(codecs),
		rules,
	};
}
