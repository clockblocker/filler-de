import type { NodeName } from "../types/schemas/node-name";
import type {
	ChangeNodeStatusAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	MoveNodeAction,
	RenameNodeAction,
	TreeAction,
} from "./tree-action/types/tree-action";
import { getNodeName } from "./tree-action/utils/locator/locator-utils";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import {
	type FileNodeSegmentId,
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "./tree-node/types/node-segment-id";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";

// ─── Helpers ───

/** Helper to make segment ID with proper type narrowing */
function makeSegmentId(node: ScrollNode): ScrollNodeSegmentId;
function makeSegmentId(node: FileNode): FileNodeSegmentId;
function makeSegmentId(node: SectionNode): SectionNodeSegmentId;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId {
	if (node.type === TreeNodeType.Section) {
		return makeNodeSegmentId(node);
	}
	if (node.type === TreeNodeType.Scroll) {
		return makeNodeSegmentId(node);
	}
	return makeNodeSegmentId(node);
}

// ─── Tree ───

export class Tree {
	private root: SectionNode;

	constructor(libraryRootName: NodeName) {
		this.root = {
			children: {},
			nodeName: libraryRootName,
			type: TreeNodeType.Section,
		};
	}

	/** Apply action to tree structure. Returns void - only modifies tree. */
	apply(action: TreeAction): void {
		const actionType = action.actionType;

		if (actionType === "Create") {
			this.applyCreate(action as CreateTreeLeafAction);
		} else if (actionType === "Delete") {
			this.applyDelete(action as DeleteNodeAction);
		} else if (actionType === "Rename") {
			this.applyRename(action as RenameNodeAction);
		} else if (actionType === "Move") {
			this.applyMove(action as MoveNodeAction);
		} else {
			// ChangeStatus
			this.applyChangeStatus(action as ChangeNodeStatusAction);
		}
	}

	// ─── Create ───

	private applyCreate(action: CreateTreeLeafAction): void {
		const { targetLocator } = action;
		const parentSection = this.ensureSectionChain(
			targetLocator.segmentIdChainToParent,
		);

		const node = this.makeLeafNode(action);
		const segmentId = makeSegmentId(node);
		parentSection.children[segmentId] = node;
	}

	private makeLeafNode(action: CreateTreeLeafAction): LeafNode {
		const nodeName = getNodeName(action.targetLocator);

		if (action.targetLocator.targetType === TreeNodeType.Scroll) {
			return {
				extension: "md",
				nodeName,
				status: action.initialStatus ?? TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
		}
		// File
		return {
			extension: action.observedSplitPath.extension,
			nodeName,
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		};
	}

	// ─── Delete ───

	private applyDelete(action: DeleteNodeAction): void {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return;

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);
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

	private applyRename(action: RenameNodeAction): void {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return;

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) return;

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		parentSection.children[newSegmentId] = node;
	}

	// ─── Move ───

	private applyMove(action: MoveNodeAction): void {
		const { targetLocator, newParentLocator, newNodeName } = action;

		// Detach from old parent
		const oldParent = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!oldParent) return;

		const node = oldParent.children[targetLocator.segmentId];
		if (!node) return;

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
		const newSegmentId = makeSegmentId(node);
		newParent.children[newSegmentId] = node;
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): void {
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
			const parent = this.findSection(
				targetLocator.segmentIdChainToParent,
			);
			if (parent) {
				const node = parent.children[targetLocator.segmentId];
				if (node && node.type !== TreeNodeType.Section) {
					(node as ScrollNode).status = newStatus;
				}
			}
		}
	}

	private propagateStatus(
		section: SectionNode,
		status: TreeNodeStatus,
	): void {
		for (const child of Object.values(section.children)) {
			if (child.type === TreeNodeType.Section) {
				this.propagateStatus(child, status);
			} else {
				(child as ScrollNode).status = status;
			}
		}
	}

	// ─── Traversal Helpers ───

	/** Find section by chain. Part of TreeAccessor interface. */
	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		// First element is Library root → current = this.root; rest → traverse children
		let current: SectionNode | null = null;
		for (const segId of chain) {
			if (!current) {
				current = this.root;
				continue;
			}
			const child = current.children[segId];
			if (!child || child.type !== TreeNodeType.Section) return undefined;
			current = child;
		}
		return current ?? this.root;
	}

	ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode {
		// First element is Library root → current = this.root; rest → traverse/create children
		let current: SectionNode | null = null;
		for (const segId of chain) {
			if (!current) {
				current = this.root;
				continue;
			}
			let child = current.children[segId];
			if (!child) {
				const nodeName = this.extractNodeNameFromSegmentId(segId);
				child = {
					children: {},
					nodeName,
					type: TreeNodeType.Section,
				};
				current.children[segId] = child;
			}
			if (child.type !== TreeNodeType.Section) {
				throw new Error(
					`Expected section at ${segId}, got ${child.type}`,
				);
			}
			current = child;
		}
		return current ?? this.root;
	}

	private extractNodeNameFromSegmentId(
		segId: SectionNodeSegmentId,
	): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	// ─── Test Helpers ───

	getRoot(): SectionNode {
		return this.root;
	}
}
