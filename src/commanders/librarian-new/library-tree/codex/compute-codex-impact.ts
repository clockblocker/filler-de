/**
 * Compute which sections are impacted by a TreeAction.
 * Used to determine which codex files need regeneration/rename/deletion.
 */

import { TreeNodeStatus, TreeNodeType } from "../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "../tree-node/types/node-segment-id";
import type { TreeAction } from "../tree-action/types/tree-action";
import { TreeActionType } from "../tree-action/types/tree-action";
import { collectImpactedSections } from "./section-chain-utils";

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
	}>;
	/** Sections deleted (codex should be deleted) */
	deleted: SectionNodeSegmentId[][];
	/** Sections whose descendants need status update (for ChangeStatus on section) */
	descendantsChanged: DescendantsStatusChange[];
};

// ─── Main ───

export function computeCodexImpact(action: TreeAction): CodexImpact {
	const impact: CodexImpact = {
		contentChanged: [],
		deleted: [],
		descendantsChanged: [],
		renamed: [],
	};

	switch (action.actionType) {
		case TreeActionType.Create:
			return computeCreateImpact(action, impact);
		case TreeActionType.Delete:
			return computeDeleteImpact(action, impact);
		case TreeActionType.Rename:
			return computeRenameImpact(action, impact);
		case TreeActionType.Move:
			return computeMoveImpact(action, impact);
		case TreeActionType.ChangeStatus:
			return computeChangeStatusImpact(action, impact);
	}
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
	if (targetLocator.targetType === TreeNodeType.Section) {
		const sectionChain = [
			...parentChain,
			targetLocator.segmentId as SectionNodeSegmentId,
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

	if (targetLocator.targetType === TreeNodeType.Section) {
		// Section rename: parent needs update + section codex moves
		impact.contentChanged.push(parentChain);

		const oldChain = [
			...parentChain,
			targetLocator.segmentId as SectionNodeSegmentId,
		];
		const newSegmentId = makeSectionSegmentId(newNodeName);
		const newChain = [...parentChain, newSegmentId];

		impact.renamed.push({ oldChain, newChain });

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
	const { targetLocator, newParentLocator, newNodeName } = action;
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

	if (targetLocator.targetType === TreeNodeType.Section) {
		// Section move: codex file moves
		const oldChain = [
			...oldParentChain,
			targetLocator.segmentId as SectionNodeSegmentId,
		];
		const newSegmentId = makeSectionSegmentId(newNodeName);
		const newChain = [...newParentChain, newSegmentId];

		impact.renamed.push({ oldChain, newChain });

		// Moved section's content needs update (parent backlink changes)
		impact.contentChanged.push(newChain);
	}

	return impact;
}

function computeChangeStatusImpact(
	action: Extract<TreeAction, { actionType: typeof TreeActionType.ChangeStatus }>,
	impact: CodexImpact,
): CodexImpact {
	const { targetLocator, newStatus } = action;
	const parentChain = targetLocator.segmentIdChainToParent;

	if (targetLocator.targetType === TreeNodeType.Section) {
		// Section status change: propagates to descendants
		const sectionChain = [
			...parentChain,
			targetLocator.segmentId as SectionNodeSegmentId,
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
	return `${nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}` as SectionNodeSegmentId;
}
