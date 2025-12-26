import type { NodeName, NodeNameChain } from "./naming/parsed-basename";
import { TreeActionType } from "./types/literals";
import type {
	ChangeNodeNameAction,
	ChangeNodeStatusAction,
	CreateNodeAction,
	DeleteNodeAction,
	MoveNodeAction,
	TreeAction,
} from "./types/tree-action";
import type { TreeLeaf } from "./types/tree-node";
import {
	type LeafNode,
	type SectionNode,
	type TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
import { joinPathPartsDeprecated } from "./utils/tree-path-utils";

export class LibraryTree {
	private root: SectionNode;
	private nodeMap: Map<string, TreeNode> = new Map();

	constructor(leaves: TreeLeaf[]) {
		this.root = this.createRootSection();
		this.buildTreeFromLeaves(leaves);
	}

	private createRootSection(): SectionNode {
		return {
			children: [],
			nodeName: "",
			nodeNameChainToParent: [],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
	}

	private buildTreeFromLeaves(leaves: TreeLeaf[]): void {
		for (const leaf of leaves) {
			this.ensureSectionPath(leaf.nodeNameChainToParent);
			this.addNodeToTree(leaf, leaf.nodeNameChainToParent);
		}
		this.recalculateSectionStatuses(this.root);
	}

	/**
	 * DFS to recalculate section statuses based on children.
	 * Section is Done if all Scroll/Section children are Done, else NotStarted.
	 * FileNodes (Unknown status) are ignored.
	 */
	private recalculateSectionStatuses(section: SectionNode): void {
		for (const child of section.children) {
			if (child.type === TreeNodeType.Section) {
				this.recalculateSectionStatuses(child);
			}
		}

		const hasNotStarted = section.children.some(
			(child) =>
				(child.type === TreeNodeType.Scroll ||
					child.type === TreeNodeType.Section) &&
				child.status === TreeNodeStatus.NotStarted,
		);

		section.status = hasNotStarted
			? TreeNodeStatus.NotStarted
			: TreeNodeStatus.Done;
	}

	private ensureSectionPath(nodeNameChain: NodeNameChain): void {
		let current = this.root;
		const path: NodeName[] = [];

		for (const segment of nodeNameChain) {
			path.push(segment);
			const existing = this.getNodeInternal(path);

			if (!existing) {
				const sectionNode: SectionNode = {
					children: [],
					nodeName: segment,
					nodeNameChainToParent: [...path.slice(0, -1)],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				current.children.push(sectionNode);
				this.nodeMap.set(joinPathPartsDeprecated(path), sectionNode);
				current = sectionNode;
			} else if (existing.type === TreeNodeType.Section) {
				current = existing as SectionNode;
			}
		}
	}

	private addNodeToTree(
		node: LeafNode,
		nodeNameChainToParent: NodeNameChain,
	): void {
		const parent = this.getParentOrThrow(nodeNameChainToParent);
		parent.children.push(node);
		const fullChain = [...nodeNameChainToParent, node.nodeName];
		this.nodeMap.set(joinPathPartsDeprecated(fullChain), node);
	}

	getNode(nodeNameChain: NodeNameChain): TreeNode | null {
		return this.getNodeInternal(nodeNameChain);
	}

	getSectionNode(nodeNameChain: NodeNameChain): SectionNode | null {
		const node = this.getNodeInternal(nodeNameChain);
		if (!node || node.type !== TreeNodeType.Section) {
			return null;
		}
		return node;
	}

	getParent(nodeNameChain: NodeNameChain): SectionNode | null {
		const node = this.getNodeInternal(nodeNameChain);
		if (!node || node.type !== TreeNodeType.Section) {
			return null;
		}
		return node;
	}

	private getParentOrThrow(nodeNameChain: NodeNameChain): SectionNode {
		const parent = this.getParent(nodeNameChain);
		if (!parent) {
			throw new Error(
				`Parent not found: ${joinPathPartsDeprecated(nodeNameChain)}`,
			);
		}
		return parent;
	}

	private getNodeInternal(nodeNameChain: NodeNameChain): TreeNode | null {
		if (nodeNameChain.length === 0) {
			return this.root;
		}
		return this.nodeMap.get(joinPathPartsDeprecated(nodeNameChain)) ?? null;
	}

	/**
	 * Apply a tree action and return impacted chain(s).
	 * MoveNode returns [oldParentChain, newParentChain].
	 * Other actions return single chain.
	 */
	applyTreeAction(
		action: TreeAction,
	): NodeNameChain | [NodeNameChain, NodeNameChain] {
		switch (action.type) {
			case TreeActionType.CreateNode:
				return this.createNode(action);
			case TreeActionType.DeleteNode:
				return this.deleteNode(action);
			case TreeActionType.ChangeNodeName:
				return this.changeNodeName(action);
			case TreeActionType.ChangeNodeStatus:
				return this.changeNodeStatus(action);
			case TreeActionType.MoveNode:
				return this.moveNode(action);
		}
	}

	private createNode(action: CreateNodeAction): NodeNameChain {
		const { nodeName, nodeNameChainToParent, nodeType } = action.payload;

		this.ensureSectionPath(nodeNameChainToParent);

		const fullChain = [...nodeNameChainToParent, nodeName];
		const existing = this.getNodeInternal(fullChain);
		if (existing) {
			return fullChain;
		}

		let newNode: TreeNode;

		if (nodeType === TreeNodeType.Scroll) {
			newNode = {
				extension: action.payload.extension,
				nodeName,
				nodeNameChainToParent,
				status: action.payload.status,
				type: TreeNodeType.Scroll,
			};
		} else if (nodeType === TreeNodeType.File) {
			newNode = {
				extension: action.payload.extension,
				nodeName,
				nodeNameChainToParent,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		} else {
			newNode = {
				children: [],
				nodeName,
				nodeNameChainToParent,
				status: action.payload.status,
				type: TreeNodeType.Section,
			};
		}

		const parent = this.getParentOrThrow(nodeNameChainToParent);
		parent.children.push(newNode);
		this.nodeMap.set(joinPathPartsDeprecated(fullChain), newNode);

		return fullChain;
	}

	private deleteNode(action: DeleteNodeAction): NodeNameChain {
		const { nodeNameChain } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return nodeNameChain;
		}

		const parentChain = node.nodeNameChainToParent;
		const parent = this.getParentOrThrow(parentChain);
		const index = parent.children.findIndex(
			(child) => child.nodeName === node.nodeName,
		);
		if (index === -1) {
			return nodeNameChain;
		}

		parent.children.splice(index, 1);
		this.nodeMap.delete(joinPathPartsDeprecated(nodeNameChain));

		if (node.type === TreeNodeType.Section) {
			this.deleteSubtree(nodeNameChain);
		}

		return parentChain;
	}

	private deleteSubtree(rootChain: NodeNameChain): void {
		const node = this.getNodeInternal(rootChain);
		if (!node || node.type !== TreeNodeType.Section) {
			return;
		}

		const sectionNode = node as SectionNode;
		for (const child of sectionNode.children) {
			const childChain = [...rootChain, child.nodeName];
			this.nodeMap.delete(joinPathPartsDeprecated(childChain));
			if (child.type === TreeNodeType.Section) {
				this.deleteSubtree(childChain);
			}
		}
	}

	private changeNodeName(action: ChangeNodeNameAction): NodeNameChain {
		const { nodeNameChain, newNodeName } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return nodeNameChain;
		}

		const oldParentChain = node.nodeNameChainToParent;
		const newFullChain = [...oldParentChain, newNodeName];

		if (this.getNodeInternal(newFullChain)) {
			throw new Error(
				`Node already exists: ${joinPathPartsDeprecated(newFullChain)}`,
			);
		}

		const parent = this.getParentOrThrow(oldParentChain);
		const index = parent.children.findIndex(
			(child) => child.nodeName === node.nodeName,
		);
		if (index === -1) {
			return nodeNameChain;
		}

		const oldKey = joinPathPartsDeprecated(nodeNameChain);
		this.nodeMap.delete(oldKey);

		node.nodeName = newNodeName;
		const newKey = joinPathPartsDeprecated(newFullChain);
		this.nodeMap.set(newKey, node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		if (node.type === TreeNodeType.Section) {
			this.updateChildrenChains(nodeNameChain, newFullChain, node);
		}

		return oldParentChain;
	}

	private updateChildrenChains(
		oldParentChain: NodeNameChain,
		newParentChain: NodeNameChain,
		sectionNode: SectionNode,
	): void {
		for (const child of sectionNode.children) {
			const oldChildChain = [...oldParentChain, child.nodeName];
			const newChildChain = [...newParentChain, child.nodeName];

			const oldKey = joinPathPartsDeprecated(oldChildChain);
			this.nodeMap.delete(oldKey);

			child.nodeNameChainToParent = newParentChain;
			const newKey = joinPathPartsDeprecated(newChildChain);
			this.nodeMap.set(newKey, child);

			if (child.type === TreeNodeType.Section) {
				this.updateChildrenChains(oldChildChain, newChildChain, child);
			}
		}
	}

	private changeNodeStatus(action: ChangeNodeStatusAction): NodeNameChain {
		const { nodeNameChain, newStatus } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return nodeNameChain;
		}

		if (
			node.type === TreeNodeType.File ||
			newStatus === TreeNodeStatus.Unknown
		) {
			return nodeNameChain;
		}

		node.status = newStatus;

		if (node.type === TreeNodeType.Section) {
			this.updateDescendantsStatus(node, newStatus);
		}

		const parentChain = node.nodeNameChainToParent;
		if (parentChain.length > 0) {
			this.updateParentStatus(parentChain);
		}

		return parentChain.length > 0 ? parentChain : nodeNameChain;
	}

	/**
	 * Move node to new parent.
	 * Returns [oldParentChain, newParentChain].
	 */
	private moveNode(action: MoveNodeAction): [NodeNameChain, NodeNameChain] {
		const { nodeNameChain, newNodeNameChainToParent } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return [nodeNameChain, newNodeNameChainToParent];
		}

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		const oldParentChain = node.nodeNameChainToParent;
		const newFullChain = [...newNodeNameChainToParent, node.nodeName];

		// Check if target already exists
		if (this.getNodeInternal(newFullChain)) {
			throw new Error(
				`Node already exists: ${joinPathPartsDeprecated(newFullChain)}`,
			);
		}

		// Ensure new parent path exists
		this.ensureSectionPath(newNodeNameChainToParent);

		// Remove from old parent
		const oldParent = this.getParentOrThrow(oldParentChain);
		const oldIndex = oldParent.children.findIndex(
			(child) => child.nodeName === node.nodeName,
		);
		if (oldIndex !== -1) {
			oldParent.children.splice(oldIndex, 1);
		}

		// Update node's parent chain
		const oldKey = joinPathPartsDeprecated(nodeNameChain);
		this.nodeMap.delete(oldKey);

		node.nodeNameChainToParent = newNodeNameChainToParent;
		const newKey = joinPathPartsDeprecated(newFullChain);
		this.nodeMap.set(newKey, node);

		// Add to new parent
		const newParent = this.getParentOrThrow(newNodeNameChainToParent);
		newParent.children.push(node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		// If section, update all children's chains recursively
		if (node.type === TreeNodeType.Section) {
			this.updateChildrenChains(nodeNameChain, newFullChain, node);
		}

		// Recalculate statuses for both old and new parents
		this.recalculateSectionStatuses(oldParent);
		this.recalculateSectionStatuses(newParent);

		return [oldParentChain, newNodeNameChainToParent];
	}

	private updateDescendantsStatus(
		sectionNode: SectionNode,
		newStatus:
			| typeof TreeNodeStatus.Done
			| typeof TreeNodeStatus.NotStarted,
	): void {
		for (const child of sectionNode.children) {
			if (
				child.type === TreeNodeType.Scroll ||
				child.type === TreeNodeType.Section
			) {
				child.status = newStatus;
				if (child.type === TreeNodeType.Section) {
					this.updateDescendantsStatus(child, newStatus);
				}
			}
		}
	}

	private updateParentStatus(parentChain: NodeNameChain): void {
		const parent = this.getParent(parentChain);
		if (!parent) {
			return;
		}

		const hasNotStarted = parent.children.some(
			(child) =>
				(child.type === TreeNodeType.Scroll ||
					child.type === TreeNodeType.Section) &&
				child.status === TreeNodeStatus.NotStarted,
		);

		const newStatus = hasNotStarted
			? TreeNodeStatus.NotStarted
			: TreeNodeStatus.Done;

		const oldStatus = parent.status;

		if (newStatus !== oldStatus) {
			parent.status = newStatus;
			const grandParentChain = parent.nodeNameChainToParent;
			if (grandParentChain.length > 0) {
				this.updateParentStatus(grandParentChain);
			}
		}
	}

	serializeToLeaves(): TreeLeaf[] {
		const result: TreeLeaf[] = [];
		this.collectLeaves(this.root, result);
		return result;
	}

	private collectLeaves(node: TreeNode, result: TreeLeaf[]): void {
		if (node === this.root) {
			for (const child of (node as SectionNode).children) {
				this.collectLeaves(child, result);
			}
			return;
		}

		if (
			node.type === TreeNodeType.Scroll ||
			node.type === TreeNodeType.File
		) {
			result.push(node as LeafNode);
		} else if (node.type === TreeNodeType.Section) {
			const sectionNode = node as SectionNode;
			for (const child of sectionNode.children) {
				this.collectLeaves(child, result);
			}
		}
	}
}
