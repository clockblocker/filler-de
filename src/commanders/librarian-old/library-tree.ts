import { getParsedUserSettings } from "../../global-state/global-state";
import { TreeActionType } from "./types/literals";
import type {
	NodeNameChainDeprecated,
	NodeNameDeprecated,
} from "./types/schemas/node-name";
import type {
	ChangeNodeNameActionDeprecated,
	ChangeNodeStatusActionDeprecated,
	CreateNodeActionDeprecated,
	DeleteNodeActionDeprecated,
	MoveNodeActionDeprecated,
	TreeActionDeprecated,
} from "./types/tree-action";
import type { TreeLeafDeprecated } from "./types/tree-node";
import {
	type LeafNodeDeprecated,
	type SectionNodeDeprecated,
	type TreeNodeDeprecated,
	TreeNodeStatusDeprecated,
	TreeNodeTypeDeprecated,
} from "./types/tree-node";
import { joinPathParts } from "./utils/tree-path-utils";

/**
 * @deprecated LibraryTree is being fully rewritten. Use new implementation when available.
 */
export class LibraryTreeDeprecated {
	private root: SectionNodeDeprecated;
	private nodeMap: Map<string, TreeNodeDeprecated> = new Map();

	constructor(leaves: TreeLeafDeprecated[]) {
		this.root = this.createRootSection();
		this.buildTreeFromLeaves(leaves);
	}

	private createRootSection(): SectionNodeDeprecated {
		const {
			splitPathToLibraryRoot: { basename: libraryRoot },
		} = getParsedUserSettings();
		return {
			children: [],
			nodeName: libraryRoot,
			nodeNameChainToParent: [],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Section,
		};
	}

	private buildTreeFromLeaves(leaves: TreeLeafDeprecated[]): void {
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
	private recalculateSectionStatuses(section: SectionNodeDeprecated): void {
		for (const child of section.children) {
			if (child.type === TreeNodeTypeDeprecated.Section) {
				this.recalculateSectionStatuses(child);
			}
		}

		const hasNotStarted = section.children.some(
			(child) =>
				(child.type === TreeNodeTypeDeprecated.Scroll ||
					child.type === TreeNodeTypeDeprecated.Section) &&
				child.status === TreeNodeStatusDeprecated.NotStarted,
		);

		section.status = hasNotStarted
			? TreeNodeStatusDeprecated.NotStarted
			: TreeNodeStatusDeprecated.Done;
	}

	private ensureSectionPath(nodeNameChain: NodeNameChainDeprecated): void {
		let current = this.root;
		const path: NodeNameDeprecated[] = [];

		for (const segment of nodeNameChain) {
			path.push(segment);
			const existing = this.getNodeInternal(path);

			if (!existing) {
				const sectionNode: SectionNodeDeprecated = {
					children: [],
					nodeName: segment,
					nodeNameChainToParent: [...path.slice(0, -1)],
					status: TreeNodeStatusDeprecated.NotStarted,
					type: TreeNodeTypeDeprecated.Section,
				};
				current.children.push(sectionNode);
				this.nodeMap.set(joinPathParts(path), sectionNode);
				current = sectionNode;
			} else if (existing.type === TreeNodeTypeDeprecated.Section) {
				current = existing as SectionNodeDeprecated;
			}
		}
	}

	private addNodeToTree(
		node: LeafNodeDeprecated,
		nodeNameChainToParent: NodeNameChainDeprecated,
	): void {
		const parent = this.getParentOrThrow(nodeNameChainToParent);
		parent.children.push(node);
		const fullChain = [...nodeNameChainToParent, node.nodeName];
		this.nodeMap.set(joinPathParts(fullChain), node);
	}

	getNode(nodeNameChain: NodeNameChainDeprecated): TreeNodeDeprecated | null {
		return this.getNodeInternal(nodeNameChain);
	}

	getSectionNode(
		nodeNameChain: NodeNameChainDeprecated,
	): SectionNodeDeprecated | null {
		const node = this.getNodeInternal(nodeNameChain);
		if (!node || node.type !== TreeNodeTypeDeprecated.Section) {
			return null;
		}
		return node;
	}

	getParent(
		nodeNameChain: NodeNameChainDeprecated,
	): SectionNodeDeprecated | null {
		const node = this.getNodeInternal(nodeNameChain);
		if (!node || node.type !== TreeNodeTypeDeprecated.Section) {
			return null;
		}
		return node;
	}

	private getParentOrThrow(
		nodeNameChain: NodeNameChainDeprecated,
	): SectionNodeDeprecated {
		const parent = this.getParent(nodeNameChain);
		if (!parent) {
			throw new Error(
				`Parent not found: ${joinPathParts(nodeNameChain)}`,
			);
		}
		return parent;
	}

	private getNodeInternal(
		nodeNameChain: NodeNameChainDeprecated,
	): TreeNodeDeprecated | null {
		if (nodeNameChain.length === 0) {
			return this.root;
		}
		return this.nodeMap.get(joinPathParts(nodeNameChain)) ?? null;
	}

	/**
	 * Apply a tree action and return impacted chain(s).
	 * MoveNode returns [oldParentChain, newParentChain].
	 * Other actions return single chain.
	 */
	applyTreeAction(
		action: TreeActionDeprecated,
	):
		| NodeNameChainDeprecated
		| [NodeNameChainDeprecated, NodeNameChainDeprecated] {
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

	private createNode(
		action: CreateNodeActionDeprecated,
	): NodeNameChainDeprecated {
		const { nodeName, nodeNameChainToParent, nodeType } = action.payload;

		this.ensureSectionPath(nodeNameChainToParent);

		const fullChain = [...nodeNameChainToParent, nodeName];
		const existing = this.getNodeInternal(fullChain);
		if (existing) {
			return fullChain;
		}

		let newNode: TreeNodeDeprecated;

		if (nodeType === TreeNodeTypeDeprecated.Scroll) {
			newNode = {
				extension: action.payload.extension,
				nodeName,
				nodeNameChainToParent,
				status: action.payload.status,
				type: TreeNodeTypeDeprecated.Scroll,
			};
		} else if (nodeType === TreeNodeTypeDeprecated.File) {
			newNode = {
				extension: action.payload.extension,
				nodeName,
				nodeNameChainToParent,
				status: TreeNodeStatusDeprecated.Unknown,
				type: TreeNodeTypeDeprecated.File,
			};
		} else {
			newNode = {
				children: [],
				nodeName,
				nodeNameChainToParent,
				status: action.payload.status,
				type: TreeNodeTypeDeprecated.Section,
			};
		}

		const parent = this.getParentOrThrow(nodeNameChainToParent);
		parent.children.push(newNode);
		this.nodeMap.set(joinPathParts(fullChain), newNode);

		return fullChain;
	}

	private deleteNode(
		action: DeleteNodeActionDeprecated,
	): NodeNameChainDeprecated {
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
		this.nodeMap.delete(joinPathParts(nodeNameChain));

		if (node.type === TreeNodeTypeDeprecated.Section) {
			this.deleteSubtree(nodeNameChain);
		}

		return parentChain;
	}

	private deleteSubtree(rootChain: NodeNameChainDeprecated): void {
		const node = this.getNodeInternal(rootChain);
		if (!node || node.type !== TreeNodeTypeDeprecated.Section) {
			return;
		}

		const sectionNode = node as SectionNodeDeprecated;
		for (const child of sectionNode.children) {
			const childChain = [...rootChain, child.nodeName];
			this.nodeMap.delete(joinPathParts(childChain));
			if (child.type === TreeNodeTypeDeprecated.Section) {
				this.deleteSubtree(childChain);
			}
		}
	}

	private changeNodeName(
		action: ChangeNodeNameActionDeprecated,
	): NodeNameChainDeprecated {
		const { nodeNameChain, newNodeName } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return nodeNameChain;
		}

		const oldParentChain = node.nodeNameChainToParent;
		const newFullChain = [...oldParentChain, newNodeName];

		if (this.getNodeInternal(newFullChain)) {
			throw new Error(
				`Node already exists: ${joinPathParts(newFullChain)}`,
			);
		}

		const parent = this.getParentOrThrow(oldParentChain);
		const index = parent.children.findIndex(
			(child) => child.nodeName === node.nodeName,
		);
		if (index === -1) {
			return nodeNameChain;
		}

		const oldKey = joinPathParts(nodeNameChain);
		this.nodeMap.delete(oldKey);

		node.nodeName = newNodeName;
		const newKey = joinPathParts(newFullChain);
		this.nodeMap.set(newKey, node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		if (node.type === TreeNodeTypeDeprecated.Section) {
			this.updateChildrenChains(nodeNameChain, newFullChain, node);
		}

		return oldParentChain;
	}

	private updateChildrenChains(
		oldParentChain: NodeNameChainDeprecated,
		newParentChain: NodeNameChainDeprecated,
		sectionNode: SectionNodeDeprecated,
	): void {
		for (const child of sectionNode.children) {
			const oldChildChain = [...oldParentChain, child.nodeName];
			const newChildChain = [...newParentChain, child.nodeName];

			const oldKey = joinPathParts(oldChildChain);
			this.nodeMap.delete(oldKey);

			child.nodeNameChainToParent = newParentChain;
			const newKey = joinPathParts(newChildChain);
			this.nodeMap.set(newKey, child);

			if (child.type === TreeNodeTypeDeprecated.Section) {
				this.updateChildrenChains(oldChildChain, newChildChain, child);
			}
		}
	}

	private changeNodeStatus(
		action: ChangeNodeStatusActionDeprecated,
	): NodeNameChainDeprecated {
		const { nodeNameChain, newStatus } = action.payload;
		const node = this.getNodeInternal(nodeNameChain);
		if (!node) {
			return nodeNameChain;
		}

		if (
			node.type === TreeNodeTypeDeprecated.File ||
			newStatus === TreeNodeStatusDeprecated.Unknown
		) {
			return nodeNameChain;
		}

		node.status = newStatus;

		if (node.type === TreeNodeTypeDeprecated.Section) {
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
	private moveNode(
		action: MoveNodeActionDeprecated,
	): [NodeNameChainDeprecated, NodeNameChainDeprecated] {
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
				`Node already exists: ${joinPathParts(newFullChain)}`,
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
		const oldKey = joinPathParts(nodeNameChain);
		this.nodeMap.delete(oldKey);

		node.nodeNameChainToParent = newNodeNameChainToParent;
		const newKey = joinPathParts(newFullChain);
		this.nodeMap.set(newKey, node);

		// Add to new parent
		const newParent = this.getParentOrThrow(newNodeNameChainToParent);
		newParent.children.push(node);

		// Note: tRef removed - TFile references become stale when files are renamed/moved

		// If section, update all children's chains recursively
		if (node.type === TreeNodeTypeDeprecated.Section) {
			this.updateChildrenChains(nodeNameChain, newFullChain, node);
		}

		// Recalculate statuses for both old and new parents
		this.recalculateSectionStatuses(oldParent);
		this.recalculateSectionStatuses(newParent);

		return [oldParentChain, newNodeNameChainToParent];
	}

	private updateDescendantsStatus(
		sectionNode: SectionNodeDeprecated,
		newStatus:
			| typeof TreeNodeStatusDeprecated.Done
			| typeof TreeNodeStatusDeprecated.NotStarted,
	): void {
		for (const child of sectionNode.children) {
			if (
				child.type === TreeNodeTypeDeprecated.Scroll ||
				child.type === TreeNodeTypeDeprecated.Section
			) {
				child.status = newStatus;
				if (child.type === TreeNodeTypeDeprecated.Section) {
					this.updateDescendantsStatus(child, newStatus);
				}
			}
		}
	}

	private updateParentStatus(parentChain: NodeNameChainDeprecated): void {
		const parent = this.getParent(parentChain);
		if (!parent) {
			return;
		}

		const hasNotStarted = parent.children.some(
			(child) =>
				(child.type === TreeNodeTypeDeprecated.Scroll ||
					child.type === TreeNodeTypeDeprecated.Section) &&
				child.status === TreeNodeStatusDeprecated.NotStarted,
		);

		const newStatus = hasNotStarted
			? TreeNodeStatusDeprecated.NotStarted
			: TreeNodeStatusDeprecated.Done;

		const oldStatus = parent.status;

		if (newStatus !== oldStatus) {
			parent.status = newStatus;
			const grandParentChain = parent.nodeNameChainToParent;
			if (grandParentChain.length > 0) {
				this.updateParentStatus(grandParentChain);
			}
		}
	}

	serializeToLeaves(): TreeLeafDeprecated[] {
		const result: TreeLeafDeprecated[] = [];
		this.collectLeaves(this.root, result);
		return result;
	}

	private collectLeaves(
		node: TreeNodeDeprecated,
		result: TreeLeafDeprecated[],
	): void {
		if (node === this.root) {
			for (const child of (node as SectionNodeDeprecated).children) {
				this.collectLeaves(child, result);
			}
			return;
		}

		if (
			node.type === TreeNodeTypeDeprecated.Scroll ||
			node.type === TreeNodeTypeDeprecated.File
		) {
			result.push(node as LeafNodeDeprecated);
		} else if (node.type === TreeNodeTypeDeprecated.Section) {
			const sectionNode = node as SectionNodeDeprecated;
			for (const child of sectionNode.children) {
				this.collectLeaves(child, result);
			}
		}
	}
}
