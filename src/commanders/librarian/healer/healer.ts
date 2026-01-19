import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../codecs/locator/types";
import type { SectionNodeSegmentId } from "../codecs/segment-id/types/segment-id";
import {
	computeDescendantSuffixHealing,
	computeLeafHealingForFile,
	computeLeafHealingForScroll,
	computeLeafMoveHealing,
	computeSectionMoveHealing,
} from "./healing-computers";
import {
	type CodexImpact,
	computeCodexImpact,
} from "./library-tree/codex/compute-codex-impact";
import type { Tree } from "./library-tree/tree";
import type {
	ChangeNodeStatusAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	MoveNodeAction,
	RenameNodeAction,
	TreeAction,
} from "./library-tree/tree-action/types/tree-action";
import type { TreeReader } from "./library-tree/tree-interfaces";
import { makeNodeSegmentId } from "./library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "./library-tree/tree-node/types/atoms";
import type {
	SectionNode,
	TreeNode,
} from "./library-tree/tree-node/types/tree-node";
import type { HealingAction } from "./library-tree/types/healing-action";
import { buildCanonicalLeafSplitPath } from "./library-tree/utils/split-path-utils";
import { parseOldSectionPath } from "./utils/old-section-path";

// ─── Result Type ───

export type { CodexImpact };

export type HealerApplyResult = {
	healingActions: HealingAction[];
	codexImpact: CodexImpact;
	/** True if tree state was actually modified */
	changed: boolean;
};

// ─── Empty Impact (for no-op actions) ───

const EMPTY_CODEX_IMPACT: CodexImpact = {
	contentChanged: [],
	deleted: [],
	descendantsChanged: [],
	impactedChains: new Set(),
	renamed: [],
};

// ─── Healer ───

export class Healer implements TreeReader {
	private tree: Tree;
	private codecs: Codecs;

	constructor(tree: Tree, codecs: Codecs) {
		this.tree = tree;
		this.codecs = codecs;
	}

	/**
	 * Main entry: apply action, return healing actions + codex impact.
	 *
	 * Key change for idempotency: codex impact and healing are only computed
	 * if the tree actually changed. This prevents infinite loops when events
	 * fire for already-applied actions.
	 */
	getHealingActionsFor(action: TreeAction): HealerApplyResult {
		// Apply action to tree (modifies tree structure), get change indicator
		const { changed, node: mutatedNode } = this.tree.apply(action);

		// If tree didn't change, skip healing - action was already applied
		if (!changed) {
			return {
				changed: false,
				codexImpact: EMPTY_CODEX_IMPACT,
				healingActions: [],
			};
		}

		// Compute codex impact AFTER applying (only if state changed)
		const codexImpact = computeCodexImpact(action);

		// Compute healing actions based on action type
		const healingActions = this.computeHealingForAction(
			action,
			mutatedNode,
		);

		return { changed: true, codexImpact, healingActions };
	}

	// ─── TreeReader Implementation ───

	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		return this.tree.findSection(chain);
	}

	getRoot(): SectionNode {
		return this.tree.getRoot();
	}

	// ─── Healing Computation ───

	private computeHealingForAction(
		action: TreeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const actionType = action.actionType;

		if (actionType === "Create") {
			return this.computeCreateHealing(action as CreateTreeLeafAction);
		}
		if (actionType === "Delete") {
			return this.computeDeleteHealing(action as DeleteNodeAction);
		}
		if (actionType === "Rename") {
			return this.computeRenameHealing(
				action as RenameNodeAction,
				mutatedNode,
			);
		}
		if (actionType === "Move") {
			return this.computeMoveHealing(
				action as MoveNodeAction,
				mutatedNode,
			);
		}
		// ChangeStatus
		return this.computeChangeStatusHealing(
			action as ChangeNodeStatusAction,
		);
	}

	private computeCreateHealing(
		action: CreateTreeLeafAction,
	): HealingAction[] {
		const { targetLocator, observedSplitPath } = action;
		// Narrow types based on locator kind
		if (targetLocator.targetKind === TreeNodeKind.Scroll) {
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				return this.computeLeafHealing(
					targetLocator,
					observedSplitPath,
				);
			}
		} else {
			if (observedSplitPath.kind === SplitPathKind.File) {
				return this.computeLeafHealing(
					targetLocator,
					observedSplitPath,
				);
			}
		}
		return [];
	}

	private computeDeleteHealing(_action: DeleteNodeAction): HealingAction[] {
		// Delete doesn't generate healing actions
		return [];
	}

	private computeRenameHealing(
		action: RenameNodeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const { targetLocator, newNodeName } = action;

		// Use mutated node directly (returned from tree.apply)
		if (!mutatedNode) return [];
		const node = mutatedNode;

		// Compute new segment ID
		// biome-ignore lint/suspicious/noExplicitAny: Type assertion needed: makeNodeSegmentId overloads require specific node types, but TypeScript can't narrow union for overload resolution
		const newSegmentId = makeNodeSegmentId(node as any);

		// If section renamed, update descendant suffixes
		if (node.kind === TreeNodeKind.Section) {
			// Old path: parent chain + OLD section name (from targetLocator.segmentId)
			const oldSectionPathResult = parseOldSectionPath(
				targetLocator.segmentIdChainToParent,
				targetLocator.segmentId as SectionNodeSegmentId,
				this.codecs,
			);
			if (oldSectionPathResult.isErr()) {
				throw new Error(
					`Failed to parse section path: ${oldSectionPathResult.error.message}`,
				);
			}
			const oldSectionPath = oldSectionPathResult.value;

			// New chain in tree (where section IS now)
			const newSectionChain = [
				...targetLocator.segmentIdChainToParent,
				newSegmentId as SectionNodeSegmentId,
			];
			// Current path in filesystem: parent chain + NEW section name
			// (parent path is oldSectionPath minus the last element)
			const parentPath = oldSectionPath.slice(0, -1);
			const currentSectionPath = [...parentPath, newNodeName];

			return computeDescendantSuffixHealing(
				newSectionChain,
				node,
				oldSectionPath,
				this.codecs,
				currentSectionPath,
			);
		}

		// Leaf rename needs observed path - but rename action doesn't carry it
		// The observed path IS the canonical path before rename (tree was in sync)
		const oldCanonicalResult = buildCanonicalLeafSplitPath(
			targetLocator as ScrollNodeLocator | FileNodeLocator,
			this.codecs,
		);
		if (oldCanonicalResult.isErr()) {
			// Error indicates bug in tree structure - propagate by throwing
			throw new Error(
				`Failed to build canonical split path from old locator: ${oldCanonicalResult.error.message}`,
			);
		}
		const oldCanonical = oldCanonicalResult.value;
		const newLocator = {
			...targetLocator,
			segmentId: newSegmentId,
		} as ScrollNodeLocator | FileNodeLocator;

		// Narrow types based on locator kind
		if (newLocator.targetKind === TreeNodeKind.Scroll) {
			if (oldCanonical.kind === SplitPathKind.MdFile) {
				return this.computeLeafHealing(newLocator, oldCanonical);
			}
		} else {
			if (oldCanonical.kind === SplitPathKind.File) {
				return this.computeLeafHealing(newLocator, oldCanonical);
			}
		}
		return [];
	}

	private computeMoveHealing(
		action: MoveNodeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const {
			targetLocator,
			newParentLocator,
			newNodeName,
			observedSplitPath,
		} = action;

		// Use mutated node directly (returned from tree.apply)
		if (!mutatedNode) return [];
		const node = mutatedNode;

		// Compute new parent chain
		const newParentChain = [
			...newParentLocator.segmentIdChainToParent,
			newParentLocator.segmentId,
		];

		// Section move
		if (node.kind === TreeNodeKind.Section) {
			// Compute old section path (before move)
			const oldSectionPathResult = parseOldSectionPath(
				targetLocator.segmentIdChainToParent,
				targetLocator.segmentId as SectionNodeSegmentId,
				this.codecs,
			);
			if (oldSectionPathResult.isErr()) {
				throw new Error(
					`Failed to parse section path: ${oldSectionPathResult.error.message}`,
				);
			}

			return computeSectionMoveHealing({
				codecs: this.codecs,
				newNodeName,
				newParentChain,
				observedSplitPath:
					observedSplitPath as SplitPathToFolderInsideLibrary,
				oldSectionPath: oldSectionPathResult.value,
				section: node,
			});
		}

		// Leaf move (Scroll or File)
		return computeLeafMoveHealing({
			codecs: this.codecs,
			newParentChain,
			node,
			observedSplitPath: observedSplitPath as
				| SplitPathToMdFileInsideLibrary
				| SplitPathToFileInsideLibrary,
		});
	}

	private computeChangeStatusHealing(
		_action: ChangeNodeStatusAction,
	): HealingAction[] {
		// ChangeStatus doesn't generate healing actions
		return [];
	}

	private computeLeafHealing(
		locator: ScrollNodeLocator,
		observedSplitPath: SplitPathToMdFileInsideLibrary,
	): HealingAction[];
	private computeLeafHealing(
		locator: FileNodeLocator,
		observedSplitPath: SplitPathToFileInsideLibrary,
	): HealingAction[];
	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath:
			| SplitPathToMdFileInsideLibrary
			| SplitPathToFileInsideLibrary,
	): HealingAction[] {
		if (locator.targetKind === TreeNodeKind.Scroll) {
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				return computeLeafHealingForScroll(
					locator,
					observedSplitPath,
					this.codecs,
				);
			}
		} else {
			if (observedSplitPath.kind === SplitPathKind.File) {
				return computeLeafHealingForFile(
					locator,
					observedSplitPath,
					this.codecs,
				);
			}
		}
		return [];
	}
}
