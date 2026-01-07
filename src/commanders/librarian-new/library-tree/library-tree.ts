import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	type SplitPath,
	type SplitPathToFile,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import type { NodeName } from "../types/schemas/node-name";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import {
	type SectionNodeSegmentId,
	NodeSegmentIdSeparator,
	type TreeNodeSegmentId,
} from "./tree-node/types/node-segment-id";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type {
	TreeAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	RenameNodeAction,
	MoveNodeAction,
	ChangeNodeStatusAction,
	TreeActionType as TreeActionTypeEnum,
} from "./tree-action/types/tree-action";
import { TreeActionType } from "./tree-action/types/tree-action";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "./tree-action/types/target-chains";
import {
	makeJoinedSuffixedBasename,
	makeSuffixPartsFromPathParts,
} from "./tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { getNodeName } from "./tree-action/utils/locator/locator-utils";

// ─── Result Type ───

export type ApplyResult = {
	healingActions: VaultAction[];
};

// ─── LibraryTree ───

export class LibraryTree {
	private root: SectionNode;

	constructor(libraryRootName: NodeName) {
		this.root = {
			nodeName: libraryRootName,
			type: TreeNodeType.Section,
			children: {},
		};
	}

	/** Main entry: apply action, return healing VaultActions */
	apply(action: TreeAction): ApplyResult {
		switch (action.actionType) {
			case TreeActionType.Create:
				return this.applyCreate(action);
			case TreeActionType.Delete:
				return this.applyDelete(action);
			case TreeActionType.Rename:
				return this.applyRename(action);
			case TreeActionType.Move:
				return this.applyMove(action);
			case TreeActionType.ChangeStatus:
				return this.applyChangeStatus(action);
		}
	}

	// ─── Create ───

	private applyCreate(action: CreateTreeLeafAction): ApplyResult {
		const { targetLocator, observedVaultSplitPath } = action;
		const parentSection = this.ensureSectionChain(
			targetLocator.segmentIdChainToParent,
		);

		const node = this.makeLeafNode(action);
		const segmentId = makeNodeSegmentId(node);
		parentSection.children[segmentId] = node;

		return this.computeLeafHealing(targetLocator, observedVaultSplitPath);
	}

	private makeLeafNode(action: CreateTreeLeafAction): LeafNode {
		const nodeName = getNodeName(action.targetLocator);

		if (action.targetLocator.targetType === TreeNodeType.Scroll) {
			return {
				nodeName,
				type: TreeNodeType.Scroll,
				status: action.initialStatus ?? TreeNodeStatus.NotStarted,
				extension: "md",
			};
		}
		// File
		return {
			nodeName,
			type: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
			extension: action.observedVaultSplitPath.extension,
		};
	}

	// ─── Delete ───

	private applyDelete(action: DeleteNodeAction): ApplyResult {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return { healingActions: [] };

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);

		return { healingActions: [] };
	}

	private pruneEmptyAncestors(chain: SectionNodeSegmentId[]): void {
		// Walk from deepest to shallowest
		for (let i = chain.length - 1; i >= 0; i--) {
			const parentChain = chain.slice(0, i);
			const segmentId = chain[i];
			if (!segmentId) continue;

			const parent = this.findSection(parentChain);
			if (!parent) break;

			const child = parent.children[segmentId];
			if (
				child &&
				child.type === TreeNodeType.Section &&
				Object.keys(child.children).length === 0
			) {
				delete parent.children[segmentId];
			} else {
				break; // Stop if non-empty
			}
		}
	}

	// ─── Rename ───

	private applyRename(action: RenameNodeAction): ApplyResult {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return { healingActions: [] };

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) return { healingActions: [] };

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeNodeSegmentId(
			node as SectionNode | ScrollNode | FileNode,
		);
		parentSection.children[newSegmentId] = node;

		// If section renamed, update descendant suffixes
		if (node.type === TreeNodeType.Section) {
			return this.computeDescendantSuffixHealing(
				[...targetLocator.segmentIdChainToParent, newSegmentId],
				node,
			);
		}

		// Leaf rename: compute healing for this leaf
		return this.computeLeafHealingFromLocator({
			...targetLocator,
			segmentId: newSegmentId,
		} as ScrollNodeLocator | FileNodeLocator);
	}

	// ─── Move ───

	private applyMove(action: MoveNodeAction): ApplyResult {
		const { targetLocator, newParentLocator, newNodeName, observedVaultSplitPath } =
			action;

		// Detach from old parent
		const oldParent = this.findSection(targetLocator.segmentIdChainToParent);
		if (!oldParent) return { healingActions: [] };

		const node = oldParent.children[targetLocator.segmentId];
		if (!node) return { healingActions: [] };

		delete oldParent.children[targetLocator.segmentId];

		// Prune old ancestors if empty
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);

		// Ensure new parent chain exists
		const newParentChain = [
			...newParentLocator.segmentIdChainToParent,
			newParentLocator.segmentId,
		];
		const newParent = this.ensureSectionChain(newParentChain);

		// Update node name and attach
		node.nodeName = newNodeName;
		const newSegmentId = makeNodeSegmentId(
			node as SectionNode | ScrollNode | FileNode,
		);
		newParent.children[newSegmentId] = node;

		// Compute healing
		if (node.type === TreeNodeType.Section) {
			return this.computeDescendantSuffixHealing(
				[...newParentChain, newSegmentId],
				node,
			);
		}

		// Leaf move
		const newLocator: ScrollNodeLocator | FileNodeLocator = {
			segmentIdChainToParent: newParentChain,
			segmentId: newSegmentId,
			targetType: node.type,
		} as ScrollNodeLocator | FileNodeLocator;

		return this.computeLeafHealing(newLocator, observedVaultSplitPath);
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): ApplyResult {
		const { targetLocator, newStatus } = action;

		if (targetLocator.targetType === TreeNodeType.Section) {
			// Propagate to descendants
			const section = this.findSection([
				...targetLocator.segmentIdChainToParent,
				targetLocator.segmentId,
			]);
			if (section) {
				this.propagateStatus(section, newStatus);
			}
		} else {
			// Direct leaf update
			const parent = this.findSection(targetLocator.segmentIdChainToParent);
			if (parent) {
				const node = parent.children[targetLocator.segmentId];
				if (node && node.type !== TreeNodeType.Section) {
					(node as ScrollNode).status = newStatus;
				}
			}
		}

		return { healingActions: [] };
	}

	private propagateStatus(section: SectionNode, status: TreeNodeStatus): void {
		for (const child of Object.values(section.children)) {
			if (child.type === TreeNodeType.Section) {
				this.propagateStatus(child, status);
			} else {
				(child as ScrollNode).status = status;
			}
		}
	}

	// ─── Traversal Helpers ───

	private findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		let current: SectionNode = this.root;
		for (const segId of chain) {
			const child = current.children[segId];
			if (!child || child.type !== TreeNodeType.Section) return undefined;
			current = child;
		}
		return current;
	}

	private ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode {
		let current: SectionNode = this.root;
		for (const segId of chain) {
			let child = current.children[segId];
			if (!child) {
				const nodeName = this.extractNodeNameFromSegmentId(segId);
				child = {
					nodeName,
					type: TreeNodeType.Section,
					children: {},
				};
				current.children[segId] = child;
			}
			if (child.type !== TreeNodeType.Section) {
				throw new Error(`Expected section at ${segId}, got ${child.type}`);
			}
			current = child;
		}
		return current;
	}

	private extractNodeNameFromSegmentId(segId: SectionNodeSegmentId): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	// ─── Healing Computation ───

	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath: SplitPathToMdFile | SplitPathToFile,
	): ApplyResult {
		const canonicalSplitPath = this.buildCanonicalLeafSplitPath(locator);
		const healingActions: VaultAction[] = [];

		if (!this.splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
			if (observedSplitPath.type === SplitPathType.MdFile) {
				healingActions.push({
					type: VaultActionType.RenameMdFile,
					payload: {
						from: observedSplitPath,
						to: canonicalSplitPath as SplitPathToMdFile,
					},
				});
			} else {
				healingActions.push({
					type: VaultActionType.RenameFile,
					payload: {
						from: observedSplitPath,
						to: canonicalSplitPath as SplitPathToFile,
					},
				});
			}
		}

		return { healingActions };
	}

	private computeLeafHealingFromLocator(
		locator: ScrollNodeLocator | FileNodeLocator,
	): ApplyResult {
		// Build observed from current canonical (no mismatch expected after rename)
		// But we need the actual filesystem path... which we don't have here.
		// For rename, the caller should provide observed path.
		// For now, return empty - rename healing is handled by the caller.
		return { healingActions: [] };
	}

	private computeDescendantSuffixHealing(
		sectionChain: SectionNodeSegmentId[],
		section: SectionNode,
	): ApplyResult {
		const healingActions: VaultAction[] = [];

		for (const [segId, child] of Object.entries(section.children)) {
			if (child.type === TreeNodeType.Section) {
				const childHealing = this.computeDescendantSuffixHealing(
					[...sectionChain, segId as SectionNodeSegmentId],
					child,
				);
				healingActions.push(...childHealing.healingActions);
			} else {
				// Leaf: compute canonical path and emit rename if needed
				const locator: ScrollNodeLocator | FileNodeLocator = {
					segmentIdChainToParent: sectionChain,
					segmentId: segId as TreeNodeSegmentId,
					targetType: child.type,
				} as ScrollNodeLocator | FileNodeLocator;

				const canonicalSplitPath = this.buildCanonicalLeafSplitPath(locator);
				// We need observed path... this is a problem.
				// For section rename, we need to track old paths.
				// TODO: This needs refinement - for now, assume caller handles observed paths.
			}
		}

		return { healingActions };
	}

	private buildCanonicalLeafSplitPath(
		locator: ScrollNodeLocator | FileNodeLocator,
	): SplitPathToMdFile | SplitPathToFile {
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRoot = splitPathToLibraryRoot.basename;

		// Build pathParts from chain
		const pathParts = [
			libraryRoot,
			...locator.segmentIdChainToParent.map((segId) =>
				this.extractNodeNameFromSegmentId(segId),
			),
		];

		// Build suffix chain (reversed pathParts without library root)
		const suffixParts = makeSuffixPartsFromPathParts({ pathParts, basename: "" });

		// Get node name from locator
		const nodeName = this.extractNodeNameFromLeafSegmentId(locator.segmentId);

		const basename = makeJoinedSuffixedBasename({
			coreName: nodeName,
			suffixParts,
		});

		if (locator.targetType === TreeNodeType.Scroll) {
			return {
				type: SplitPathType.MdFile,
				pathParts,
				basename,
				extension: "md",
			};
		}

		// Extract extension from segmentId
		const extension = this.extractExtensionFromSegmentId(locator.segmentId);
		return {
			type: SplitPathType.File,
			pathParts,
			basename,
			extension,
		};
	}

	private extractNodeNameFromLeafSegmentId(segId: TreeNodeSegmentId): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	private extractExtensionFromSegmentId(segId: TreeNodeSegmentId): string {
		const sep = NodeSegmentIdSeparator;
		const parts = segId.split(sep);
		return parts[parts.length - 1] ?? "";
	}

	private splitPathsEqual(a: SplitPath, b: SplitPath): boolean {
		if (a.type !== b.type) return false;
		if (a.basename !== b.basename) return false;
		if (a.pathParts.length !== b.pathParts.length) return false;
		for (let i = 0; i < a.pathParts.length; i++) {
			if (a.pathParts[i] !== b.pathParts[i]) return false;
		}
		if ("extension" in a && "extension" in b && a.extension !== b.extension) {
			return false;
		}
		return true;
	}

	// ─── Test Helpers ───

	getRoot(): SectionNode {
		return this.root;
	}
}

