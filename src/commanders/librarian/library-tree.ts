import { TreeActionType } from "./types/literals";
import type { CoreName, CoreNameChainFromRoot } from "./types/split-basename";
import type {
	ChangeNodeNameAction,
	ChangeNodeStatusAction,
	CreateNodeAction,
	DeleteNodeAction,
	MoveNodeAction,
	TreeAction,
} from "./types/tree-action";
import type { TreeLeaf } from "./types/tree-leaf";
import {
	type LeafNode,
	type SectionNode,
	type TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
import { joinPathParts } from "./utils/tree-path-utils";

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
			coreName: "",
			coreNameChainToParent: [],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
	}

	private buildTreeFromLeaves(leaves: TreeLeaf[]): void {
		for (const leaf of leaves) {
			this.ensureSectionPath(leaf.coreNameChainToParent);
			this.addNodeToTree(leaf, leaf.coreNameChainToParent);
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

	private ensureSectionPath(coreNameChain: CoreNameChainFromRoot): void {
		let current = this.root;
		const path: CoreName[] = [];

		for (const segment of coreNameChain) {
			path.push(segment);
			const existing = this.getNodeInternal(path);

			if (!existing) {
				const sectionNode: SectionNode = {
					children: [],
					coreName: segment,
					coreNameChainToParent: [...path.slice(0, -1)],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				current.children.push(sectionNode);
				this.nodeMap.set(joinPathParts(path), sectionNode);
				current = sectionNode;
			} else if (existing.type === TreeNodeType.Section) {
				current = existing as SectionNode;
			}
		}
	}

	private addNodeToTree(
		node: LeafNode,
		coreNameChainToParent: CoreNameChainFromRoot,
	): void {
		const parent = this.getParentOrThrow(coreNameChainToParent);
		parent.children.push(node);
		const fullChain = [...coreNameChainToParent, node.coreName];
		this.nodeMap.set(joinPathParts(fullChain), node);
	}

	getNode(coreNameChain: CoreNameChainFromRoot): TreeNode | null {
		return this.getNodeInternal(coreNameChain);
	}

	getParent(coreNameChain: CoreNameChainFromRoot): SectionNode | null {
		const node = this.getNodeInternal(coreNameChain);
		if (!node || node.type !== TreeNodeType.Section) {
			return null;
		}
		return node;
	}

	private getParentOrThrow(
		coreNameChain: CoreNameChainFromRoot,
	): SectionNode {
		const parent = this.getParent(coreNameChain);
		if (!parent) {
			throw new Error(
				`Parent not found: ${joinPathParts(coreNameChain)}`,
			);
		}
		return parent;
	}

	private getNodeInternal(
		coreNameChain: CoreNameChainFromRoot,
	): TreeNode | null {
		if (coreNameChain.length === 0) {
			return this.root;
		}
		return this.nodeMap.get(joinPathParts(coreNameChain)) ?? null;
	}

	/**
	 * Apply a tree action and return impacted chain(s).
	 * MoveNode returns [oldParentChain, newParentChain].
	 * Other actions return single chain.
	 */
	applyTreeAction(
		action: TreeAction,
	): CoreNameChainFromRoot | [CoreNameChainFromRoot, CoreNameChainFromRoot] {
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

	private createNode(action: CreateNodeAction): CoreNameChainFromRoot {
		const { coreName, coreNameChainToParent, nodeType } = action.payload;

		this.ensureSectionPath(coreNameChainToParent);

		const fullChain = [...coreNameChainToParent, coreName];
		const existing = this.getNodeInternal(fullChain);
		if (existing) {
			return fullChain;
		}

		let newNode: TreeNode;

		if (nodeType === TreeNodeType.Scroll) {
			newNode = {
				coreName,
				coreNameChainToParent,
				extension: action.payload.extension,
				status: action.payload.status,
				type: TreeNodeType.Scroll,
			};
		} else if (nodeType === TreeNodeType.File) {
			newNode = {
				coreName,
				coreNameChainToParent,
				extension: action.payload.extension,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		} else {
			newNode = {
				children: [],
				coreName,
				coreNameChainToParent,
				status: action.payload.status,
				type: TreeNodeType.Section,
			};
		}

		const parent = this.getParentOrThrow(coreNameChainToParent);
		parent.children.push(newNode);
		this.nodeMap.set(joinPathParts(fullChain), newNode);

		return fullChain;
	}

	private deleteNode(action: DeleteNodeAction): CoreNameChainFromRoot {
		const { coreNameChain } = action.payload;
		const node = this.getNodeInternal(coreNameChain);
		if (!node) {
			return coreNameChain;
		}

		const parentChain = node.coreNameChainToParent;
		const parent = this.getParentOrThrow(parentChain);
		const index = parent.children.findIndex(
			(child) => child.coreName === node.coreName,
		);
		if (index === -1) {
			return coreNameChain;
		}

		parent.children.splice(index, 1);
		this.nodeMap.delete(joinPathParts(coreNameChain));

		if (node.type === TreeNodeType.Section) {
			this.deleteSubtree(coreNameChain);
		}

		return parentChain;
	}

	private deleteSubtree(rootChain: CoreNameChainFromRoot): void {
		const node = this.getNodeInternal(rootChain);
		if (!node || node.type !== TreeNodeType.Section) {
			return;
		}

		const sectionNode = node as SectionNode;
		for (const child of sectionNode.children) {
			const childChain = [...rootChain, child.coreName];
			this.nodeMap.delete(joinPathParts(childChain));
			if (child.type === TreeNodeType.Section) {
				this.deleteSubtree(childChain);
			}
		}
	}

	private changeNodeName(
		action: ChangeNodeNameAction,
	): CoreNameChainFromRoot {
		const { coreNameChain, newCoreName } = action.payload;
		const node = this.getNodeInternal(coreNameChain);
		if (!node) {
			return coreNameChain;
		}

		const oldParentChain = node.coreNameChainToParent;
		const newFullChain = [...oldParentChain, newCoreName];

		if (this.getNodeInternal(newFullChain)) {
			throw new Error(
				`Node already exists: ${joinPathParts(newFullChain)}`,
			);
		}

		const parent = this.getParentOrThrow(oldParentChain);
		const index = parent.children.findIndex(
			(child) => child.coreName === node.coreName,
		);
		if (index === -1) {
			return coreNameChain;
		}

		const oldKey = joinPathParts(coreNameChain);
		this.nodeMap.delete(oldKey);

		node.coreName = newCoreName;
		const newKey = joinPathParts(newFullChain);
		this.nodeMap.set(newKey, node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		if (node.type === TreeNodeType.Section) {
			this.updateChildrenChains(coreNameChain, newFullChain, node);
		}

		return oldParentChain;
	}

	private updateChildrenChains(
		oldParentChain: CoreNameChainFromRoot,
		newParentChain: CoreNameChainFromRoot,
		sectionNode: SectionNode,
	): void {
		for (const child of sectionNode.children) {
			const oldChildChain = [...oldParentChain, child.coreName];
			const newChildChain = [...newParentChain, child.coreName];

			const oldKey = joinPathParts(oldChildChain);
			this.nodeMap.delete(oldKey);

			child.coreNameChainToParent = newParentChain;
			const newKey = joinPathParts(newChildChain);
			this.nodeMap.set(newKey, child);

			if (child.type === TreeNodeType.Section) {
				this.updateChildrenChains(oldChildChain, newChildChain, child);
			}
		}
	}

	private changeNodeStatus(
		action: ChangeNodeStatusAction,
	): CoreNameChainFromRoot {
		const { coreNameChain, newStatus } = action.payload;
		const node = this.getNodeInternal(coreNameChain);
		if (!node) {
			return coreNameChain;
		}

		if (
			node.type === TreeNodeType.File ||
			newStatus === TreeNodeStatus.Unknown
		) {
			return coreNameChain;
		}

		node.status = newStatus;

		if (node.type === TreeNodeType.Section) {
			this.updateDescendantsStatus(node, newStatus);
		}

		const parentChain = node.coreNameChainToParent;
		if (parentChain.length > 0) {
			this.updateParentStatus(parentChain);
		}

		return parentChain.length > 0 ? parentChain : coreNameChain;
	}

	/**
	 * Move node to new parent.
	 * Returns [oldParentChain, newParentChain].
	 */
	private moveNode(
		action: MoveNodeAction,
	): [CoreNameChainFromRoot, CoreNameChainFromRoot] {
		const { coreNameChain, newCoreNameChainToParent } = action.payload;
		const node = this.getNodeInternal(coreNameChain);
		if (!node) {
			return [coreNameChain, newCoreNameChainToParent];
		}

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		const oldParentChain = node.coreNameChainToParent;
		const newFullChain = [...newCoreNameChainToParent, node.coreName];

		// Check if target already exists
		if (this.getNodeInternal(newFullChain)) {
			throw new Error(
				`Node already exists: ${joinPathParts(newFullChain)}`,
			);
		}

		// Ensure new parent path exists
		this.ensureSectionPath(newCoreNameChainToParent);

		// Remove from old parent
		const oldParent = this.getParentOrThrow(oldParentChain);
		const oldIndex = oldParent.children.findIndex(
			(child) => child.coreName === node.coreName,
		);
		if (oldIndex !== -1) {
			oldParent.children.splice(oldIndex, 1);
		}

		// Update node's parent chain
		const oldKey = joinPathParts(coreNameChain);
		this.nodeMap.delete(oldKey);

		node.coreNameChainToParent = newCoreNameChainToParent;
		const newKey = joinPathParts(newFullChain);
		this.nodeMap.set(newKey, node);

		// Add to new parent
		const newParent = this.getParentOrThrow(newCoreNameChainToParent);
		newParent.children.push(node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		// If section, update all children's chains recursively
		if (node.type === TreeNodeType.Section) {
			this.updateChildrenChains(coreNameChain, newFullChain, node);
		}

		// Recalculate statuses for both old and new parents
		this.recalculateSectionStatuses(oldParent);
		this.recalculateSectionStatuses(newParent);

		return [oldParentChain, newCoreNameChainToParent];
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

	private updateParentStatus(parentChain: CoreNameChainFromRoot): void {
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
			const grandParentChain = parent.coreNameChainToParent;
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
