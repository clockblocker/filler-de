/**
 * Compute which sections are impacted by a TreeAction.
 * Used to determine which codex files need regeneration/rename/deletion.
 */

import type { SectionNodeSegmentId } from "../../../codecs/segment-id";
import { NodeSegmentIdSeparator } from "../../../codecs/segment-id/types/segment-id";
import { locatorToSectionSegmentId } from "../../../paths/path-finder";
import type { TreeAction } from "../tree-action/types/tree-action";
import { TreeActionType } from "../tree-action/types/tree-action";
import { TreeNodeKind, type TreeNodeStatus } from "../tree-node/types/atoms";
import { chainToKey, collectImpactedSections } from "./section-chain-utils";

// ─── Types ───

export type DescendantsStatusChange = {
	sectionChain: SectionNodeSegmentId[];
	newStatus: TreeNodeStatus;
};

export type CodexImpact = {
	/** Sections whose codex content changed (children added/removed/renamed/status changed) */
	contentChanged: SectionNodeSegmentId[][];
	/** Sections whose codex file needs rename (section itself renamed/moved) */
	renamed: Array<{
		oldChain: SectionNodeSegmentId[];
		newChain: SectionNodeSegmentId[];
		/**
		 * For Move actions only: the INTERMEDIATE path where Obsidian moved the folder.
		 * This is where the old codex file actually IS after the user's folder rename,
		 * before our healing folder rename executes.
		 * Undefined for Rename actions (no intermediate state - Obsidian's rename IS final).
		 */
		observedPathParts?: string[];
	}>;
	/** Sections deleted (codex should be deleted) */
	deleted: SectionNodeSegmentId[][];
	/** Sections whose descendants need status update (for ChangeStatus on section) */
	descendantsChanged: DescendantsStatusChange[];
	/** All impacted chains (contentChanged + renamed.newChain + their ancestors) - for incremental updates */
	impactedChains: Set<string>;
};

// ─── Main ───

export function computeCodexImpact(action: TreeAction): CodexImpact {
	const impact: CodexImpact = {
		contentChanged: [],
		deleted: [],
		descendantsChanged: [],
		impactedChains: new Set(),
		renamed: [],
	};

	let result: CodexImpact;
	switch (action.actionType) {
		case TreeActionType.Create:
			result = computeCreateImpact(action, impact);
			break;
		case TreeActionType.Delete:
			result = computeDeleteImpact(action, impact);
			break;
		case TreeActionType.Rename:
			result = computeRenameImpact(action, impact);
			break;
		case TreeActionType.Move:
			result = computeMoveImpact(action, impact);
			break;
		case TreeActionType.ChangeStatus:
			result = computeChangeStatusImpact(action, impact);
			break;
	}

	// Populate impactedChains from contentChanged + renamed.newChain + their ancestors
	populateImpactedChains(result);
	return result;
}

// ─── Per-action Impact ───

function computeCreateImpact(
	action: Extract<TreeAction, { actionType: typeof TreeActionType.Create }>,
	impact: CodexImpact,
): CodexImpact {
	// Parent + ancestors need content update
	const parentChain = action.targetLocator.segmentIdChainToParent;
	impact.contentChanged = collectImpactedSections([parentChain]);
	return impact;
}

function computeDeleteImpact(
	action: Extract<TreeAction, { actionType: typeof TreeActionType.Delete }>,
	impact: CodexImpact,
): CodexImpact {
	const { targetLocator } = action;
	const parentChain = targetLocator.segmentIdChainToParent;

	// Parent + ancestors need content update
	impact.contentChanged = collectImpactedSections([parentChain]);

	// If deleting a section, mark it as deleted
	if (targetLocator.targetKind === TreeNodeKind.Section) {
		const sectionChain = [
			...parentChain,
			locatorToSectionSegmentId(targetLocator),
		];
		impact.deleted.push(sectionChain);
		// Note: descendants are implicitly deleted with the section
		// The tree handles this, we just need to delete the section's codex
	}

	return impact;
}

function computeRenameImpact(
	action: Extract<TreeAction, { actionType: typeof TreeActionType.Rename }>,
	impact: CodexImpact,
): CodexImpact {
	const { targetLocator, newNodeName } = action;
	const parentChain = targetLocator.segmentIdChainToParent;

	if (targetLocator.targetKind === TreeNodeKind.Section) {
		// Section rename: parent needs update + section codex moves
		impact.contentChanged.push(parentChain);

		const oldChain = [
			...parentChain,
			locatorToSectionSegmentId(targetLocator),
		];
		const newSegmentId = makeSectionSegmentId(newNodeName);
		const newChain = [...parentChain, newSegmentId];

		impact.renamed.push({ newChain, oldChain });

		// Renamed section's content also needs update (parent backlink text changes)
		impact.contentChanged.push(newChain);
	} else {
		// Leaf rename: only parent needs update (link text changes)
		impact.contentChanged.push(parentChain);
	}

	return impact;
}

function computeMoveImpact(
	action: Extract<TreeAction, { actionType: typeof TreeActionType.Move }>,
	impact: CodexImpact,
): CodexImpact {
	const { targetLocator, newParentLocator, newNodeName, observedSplitPath } =
		action;
	const oldParentChain = targetLocator.segmentIdChainToParent;
	const newParentChain = [
		...newParentLocator.segmentIdChainToParent,
		newParentLocator.segmentId,
	];

	// Both old and new parent trees need content update
	impact.contentChanged = collectImpactedSections([
		oldParentChain,
		newParentChain,
	]);

	if (targetLocator.targetKind === TreeNodeKind.Section) {
		// Section move: codex file moves
		const oldChain = [
			...oldParentChain,
			locatorToSectionSegmentId(targetLocator),
		];
		const newSegmentId = makeSectionSegmentId(newNodeName);
		const newChain = [...newParentChain, newSegmentId];

		// Include observedPathParts for Move actions - this is where Obsidian
		// actually moved the folder (intermediate location), needed to delete
		// the old codex at the correct path before folder healing executes.
		// For folders: pathParts is the parent path, basename is the folder name.
		// Full folder path = [...pathParts, basename]
		const fullObservedPath = [
			...observedSplitPath.pathParts,
			observedSplitPath.basename,
		];
		impact.renamed.push({
			newChain,
			observedPathParts: fullObservedPath,
			oldChain,
		});

		// Moved section's content needs update (parent backlink changes)
		impact.contentChanged.push(newChain);
	}

	return impact;
}

function computeChangeStatusImpact(
	action: Extract<
		TreeAction,
		{ actionType: typeof TreeActionType.ChangeStatus }
	>,
	impact: CodexImpact,
): CodexImpact {
	const { targetLocator, newStatus } = action;
	const parentChain = targetLocator.segmentIdChainToParent;

	if (targetLocator.targetKind === TreeNodeKind.Section) {
		// Section status change: propagates to descendants
		const sectionChain = [
			...parentChain,
			locatorToSectionSegmentId(targetLocator),
		];

		// Section + ancestors need update (aggregated status changes)
		impact.contentChanged = collectImpactedSections([sectionChain]);

		// Mark section for descendant update with the new status
		impact.descendantsChanged.push({ newStatus, sectionChain });
	} else {
		// Leaf status change: parent + ancestors need update
		impact.contentChanged = collectImpactedSections([parentChain]);
	}

	return impact;
}

// ─── Helpers ───

function makeSectionSegmentId(nodeName: string): SectionNodeSegmentId {
	return `${nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}` as SectionNodeSegmentId;
}

/**
 * Populate impactedChains by walking contentChanged + renamed chains and their ancestors.
 * This enables O(k) incremental updates instead of O(n) full tree traversal.
 */
function populateImpactedChains(impact: CodexImpact): void {
	const addChainAndAncestors = (chain: SectionNodeSegmentId[]): void => {
		// Add the chain itself
		impact.impactedChains.add(chainToKey(chain));
		// Add all ancestor chains
		for (let i = chain.length - 1; i >= 1; i--) {
			impact.impactedChains.add(chainToKey(chain.slice(0, i)));
		}
	};

	// Add contentChanged chains and their ancestors
	for (const chain of impact.contentChanged) {
		addChainAndAncestors(chain);
	}

	// Add renamed.newChain and their ancestors (old chains are handled as deletions)
	for (const { newChain } of impact.renamed) {
		addChainAndAncestors(newChain);
	}

	// Add descendantsChanged chains and their ancestors
	for (const { sectionChain } of impact.descendantsChanged) {
		addChainAndAncestors(sectionChain);
	}
}
