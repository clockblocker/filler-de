import type { TFile, TFolder } from "obsidian";
import { TreeActionType } from "./types/literals";
import type { CoreName, CoreNameChainFromRoot } from "./types/split-basename";
import type {
	ChangeNodeNameAction,
	ChangeNodeStatusAction,
	CreateNodeAction,
	DeleteNodeAction,
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

export class LibraryTree {
	private root: SectionNode;
	private nodeMap: Map<string, TreeNode> = new Map();
	private readonly rootFolderName: string;

	constructor(leaves: TreeLeaf[], rootFolder: TFolder) {
		this.rootFolderName = rootFolder.name;
		this.root = this.createRootSection(rootFolder);
		this.buildTreeFromLeaves(leaves);
	}

	private createRootSection(_rootFolder: TFolder): SectionNode {
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
				this.nodeMap.set(this.getNodeKey(path), sectionNode);
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
		this.nodeMap.set(this.getNodeKey(fullChain), node);
	}

	private getNodeKey(coreNameChain: CoreNameChainFromRoot): string {
		return coreNameChain.join("/");
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
			throw new Error(`Parent not found: ${coreNameChain.join("/")}`);
		}
		return parent;
	}

	private getNodeInternal(
		coreNameChain: CoreNameChainFromRoot,
	): TreeNode | null {
		if (coreNameChain.length === 0) {
			return this.root;
		}
		return this.nodeMap.get(this.getNodeKey(coreNameChain)) ?? null;
	}

	applyTreeAction(action: TreeAction): CoreNameChainFromRoot {
		switch (action.type) {
			case TreeActionType.CreateNode:
				return this.createNode(action);
			case TreeActionType.DeleteNode:
				return this.deleteNode(action);
			case TreeActionType.ChangeNodeName:
				return this.changeNodeName(action);
			case TreeActionType.ChangeNodeStatus:
				return this.changeNodeStatus(action);
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
				status: action.payload.status,
				tRef: action.payload.tRef,
				type: TreeNodeType.Scroll,
			};
		} else if (nodeType === TreeNodeType.File) {
			newNode = {
				coreName,
				coreNameChainToParent,
				status: TreeNodeStatus.Unknown,
				tRef: action.payload.tRef,
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
		this.nodeMap.set(this.getNodeKey(fullChain), newNode);

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
		this.nodeMap.delete(this.getNodeKey(coreNameChain));

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
			this.nodeMap.delete(this.getNodeKey(childChain));
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
			throw new Error(`Node already exists: ${newFullChain.join("/")}`);
		}

		const parent = this.getParentOrThrow(oldParentChain);
		const index = parent.children.findIndex(
			(child) => child.coreName === node.coreName,
		);
		if (index === -1) {
			return coreNameChain;
		}

		const oldKey = this.getNodeKey(coreNameChain);
		this.nodeMap.delete(oldKey);

		node.coreName = newCoreName;
		const newKey = this.getNodeKey(newFullChain);
		this.nodeMap.set(newKey, node);

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

			const oldKey = this.getNodeKey(oldChildChain);
			this.nodeMap.delete(oldKey);

			child.coreNameChainToParent = newParentChain;
			const newKey = this.getNodeKey(newChildChain);
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
