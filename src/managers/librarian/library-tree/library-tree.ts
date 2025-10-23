import type { Maybe } from "../../../types/common-interface/maybe";
import { areShallowEqual } from "../pure-functions/node";
import {
	type BranchNode,
	NodeStatus,
	NodeType,
	type PageNode,
	type SectionNode,
	type SerializedText,
	type TextNode,
	type TreeNode,
	type TreePath,
} from "../types";
import { bfs } from "./helpers/walks";

export class LibraryTree {
	root: SectionNode;

	constructor(serializedTexts: SerializedText[], name: string) {
		this.root = {
			children: [],
			name,
			parent: null,
			status: NodeStatus.NotStarted,
			type: NodeType.Section,
		};

		// Build tree from serialized texts
		for (const serializedText of serializedTexts) {
			this.addText(serializedText);
		}

		// Compute initial statuses for all nodes
		this.recomputeStatuses();
	}

	public getTexts(path: TreePath): SerializedText[] {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return [];
		}

		const textNodes = this.getTextNodesFromNode(mbNode.data as BranchNode);
		return textNodes.map(
			(node) =>
				({
					pageStatuses: node.children.map((child) => child.status),
					path: path,
				}) satisfies SerializedText,
		);
	}

	public getAllTexts(): SerializedText[] {
		return this.root.children.flatMap((child) =>
			this.getAllTextsRecursive(child, [child.name]),
		);
	}

	private getAllTextsRecursive(
		node: BranchNode,
		path: TreePath,
	): SerializedText[] {
		if (node.type === NodeType.Text) {
			const textNode = node as TextNode;
			return [
				{
					pageStatuses: textNode.children.map(
						(child) => child.status,
					),
					path: path,
				} satisfies SerializedText,
			];
		}

		if (node.type === NodeType.Section) {
			const section = node as SectionNode;
			return section.children.flatMap((child) =>
				this.getAllTextsRecursive(child, [...path, child.name]),
			);
		}

		return [];
	}

	public addText(serializedText: SerializedText): Maybe<TextNode> {
		const textNode = this.getOrCreateTextNode({
			path: serializedText.path,
		});
		if (textNode.error) {
			return textNode;
		}

		textNode.data.children = Array.from(
			{ length: serializedText.pageStatuses.length },
			(_, name) =>
				({
					name: name,
					parent: textNode.data,
					status: serializedText.pageStatuses[name] as NodeStatus,
					type: NodeType.Page,
				}) satisfies PageNode,
		);

		// Initialize parent references for the newly created node
		this.initializeParents();

		// Recompute statuses after adding pages
		this.recomputeStatuses();

		return { data: textNode.data, error: false };
	}

	public deleteText({ path }: { path: TreePath }): void {
		const node = this.getMaybeNode({ path });
		if (node.error) {
			return;
		}

		// Handle root-level text nodes
		if (path.length === 1) {
			const textName = path[0];
			const textIndex = this.root.children.findIndex(
				(child) =>
					child.type === NodeType.Text && child.name === textName,
			);

			if (textIndex !== -1) {
				this.root.children.splice(textIndex, 1);
			}
			this.recomputeStatuses();
			return;
		}

		// Handle nested text nodes
		const parentChain = this.getParentChain({ path });
		if (parentChain.length === 0) {
			return;
		}

		const textName = path[path.length - 1];
		const parent = parentChain[0];

		if (!parent || !textName) {
			return;
		}

		// Delete the text node from its parent
		const textIndex = parent.children.findIndex(
			(child) => child.type === NodeType.Text && child.name === textName,
		);

		if (textIndex !== -1) {
			parent.children.splice(textIndex, 1);
		}

		// Remove empty section nodes up the chain
		for (let i = 0; i < parentChain.length; i++) {
			const current = parentChain[i];
			const isLastNode = i === parentChain.length - 1;

			if (current && current.children.length === 0) {
				if (isLastNode) {
					// Last node in chain - remove from root if it's empty
					const rootIndex = this.root.children.findIndex(
						(child) =>
							child.name === current.name &&
							child.type === current.type,
					);
					if (rootIndex !== -1) {
						this.root.children.splice(rootIndex, 1);
					}
				} else {
					// Not the last node - remove from its parent
					const grandParent = parentChain[i + 1];
					if (grandParent) {
						const sectionIndex = grandParent.children.findIndex(
							(child) =>
								child.name === current.name &&
								child.type === current.type,
						);

						if (sectionIndex !== -1) {
							grandParent.children.splice(sectionIndex, 1);
						}
					}
				}
			} else {
				// Stop if we find a non-empty parent
				break;
			}
		}

		// Recompute statuses after deletion
		this.recomputeStatuses();
	}

	public changeStatus({
		path,
		status,
	}: {
		path: TreePath;
		status: "Done" | "NotStarted";
	}): Maybe<BranchNode> {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		const node = mbNode.data as BranchNode;

		// DFS to find all text nodes and update their page statuses
		this.setPageStatusesRecursive(node, status);

		// Recompute all statuses based on the new page statuses
		this.recomputeStatuses();

		return { data: node, error: false };
	}

	private setPageStatusesRecursive(
		node: BranchNode,
		status: "Done" | "NotStarted",
	): void {
		if (node.type === NodeType.Text) {
			const textNode = node as TextNode;
			// Set all page statuses to the given status
			for (const page of textNode.children) {
				page.status = status as NodeStatus;
			}
		} else if (node.type === NodeType.Section) {
			const section = node as SectionNode;
			// Recursively process all children
			for (const child of section.children) {
				this.setPageStatusesRecursive(child, status);
			}
		}
	}

	public getDiff(other: LibraryTree): TreeNode[] {
		const otherSet = new Map<string, TreeNode>();
		for (const { node, path } of bfs(other.root)) {
			otherSet.set(path.join("-"), node);
		}

		const diff: TreeNode[] = [];

		for (const { node, path } of bfs(this.root)) {
			const key = path.join("-");
			const otherNode = otherSet.get(key);
			if (!otherNode) {
				diff.push(node);
				continue;
			}

			const found = areShallowEqual(node, otherNode);
			if (!found) {
				diff.push(node);
			}
		}

		return diff;
	}

	public isEqualTo(other: LibraryTree): boolean {
		return this.getDiff(other).length === 0;
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<BranchNode> {
		// Empty path returns the tree itself (root)
		if (path.length === 0) {
			return { data: this.root, error: false };
		}

		let candidats = this.root.children;
		let lastMatchingNode: BranchNode | undefined;

		for (const part of path) {
			lastMatchingNode = candidats.find((node) => node.name === part);

			if (!lastMatchingNode) {
				return { description: `Node "${part}" not found`, error: true };
			}
			if (lastMatchingNode.type === NodeType.Section) {
				candidats = lastMatchingNode.children;
			} else {
				candidats = [];
			}
		}

		return lastMatchingNode
			? { data: lastMatchingNode, error: false }
			: { description: `Node ${path.join("-")} not found`, error: true };
	}

	getMaybePage({
		path,
		name,
	}: {
		path: TreePath;
		name: number;
	}): Maybe<PageNode> {
		const maybeNode = this.getMaybeNode({ path });
		if (maybeNode.error) {
			return maybeNode;
		}

		const node = maybeNode.data as TextNode;
		if (node.type !== NodeType.Text) {
			return {
				description: `Node ${path.join("-")} is not a text`,
				error: true,
			};
		}

		const page = node.children.find((child) => child.name === name);
		if (!page) {
			return { description: `Page ${name} not found`, error: true };
		}

		return {
			data: page,
			error: false,
		};
	}

	getParentNode({ path }: { path: TreePath }): Maybe<BranchNode> {
		const nodeCheck = this.getMaybeNode({ path });
		if (nodeCheck.error) {
			return nodeCheck;
		}

		if (path.length === 1) {
			return { data: this.root, error: false };
		}

		const parentPath = path.slice(0, -1) as TreePath;
		return this.getMaybeNode({ path: parentPath });
	}

	getOrCreateSectionNode({ path }: { path: TreePath }): Maybe<SectionNode> {
		if (path.length === 0) {
			return {
				description: "Path is empty",
				error: true,
			};
		}

		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error && mbNode.data.type === NodeType.Section) {
			return { data: mbNode.data as SectionNode, error: false };
		}

		const pathCopy = [...path];
		const name = pathCopy.pop();
		const pathToParent = pathCopy;

		if (!name) {
			return {
				description: "Path is empty",
				error: true,
			};
		}

		const sectionNode: SectionNode = {
			children: [],
			name,
			parent: null,
			status: NodeStatus.NotStarted,
			type: NodeType.Section,
		};

		// Handle root-level section creation
		if (pathToParent.length === 0) {
			sectionNode.parent = null;
			this.root.children.push(sectionNode);
			return { data: sectionNode, error: false };
		}

		// Handle nested section creation
		const mbParent = this.getMaybeNode({ path: pathToParent as TreePath });

		if (mbParent.error) {
			return mbParent;
		}
		if (mbParent.data.type !== NodeType.Section) {
			return {
				description: "Parent is not a section",
				error: true,
			};
		}

		const parent = mbParent.data as SectionNode;
		sectionNode.parent = parent;
		parent.children.push(sectionNode);

		return { data: sectionNode, error: false };
	}

	getOrCreateTextNode({ path }: { path: TreePath }): Maybe<TextNode> {
		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error && mbNode.data.type === NodeType.Text) {
			return { data: mbNode.data, error: false };
		}

		let parent: SectionNode | undefined;
		for (let i = 0; i < path.length - 1; i++) {
			const mbSection = this.getOrCreateSectionNode({
				path: path.slice(0, i + 1) as TreePath,
			});
			if (mbSection.error) {
				return mbSection;
			}
			parent = mbSection.data;
		}

		const pathCopy = [...path];
		const textName = pathCopy.pop();
		if (!textName) {
			return {
				description: "Text name is empty",
				error: true,
			};
		}

		// Handle root-level text node (path.length === 1)
		if (path.length === 1) {
			// Check if TextNode with the same name already exists at root
			const existing = this.root.children.find(
				(node) => node.type === NodeType.Text && node.name === textName,
			) as TextNode;

			if (existing) {
				return { data: existing, error: false };
			}

			const textNode: TextNode = {
				children: [],
				name: textName,
				parent: null,
				status: NodeStatus.NotStarted,
				type: NodeType.Text,
			};

			this.root.children.push(textNode);
			return { data: textNode, error: false };
		}

		if (!parent) {
			return {
				description:
					"No parent section found for TextNode. Path too short?",
				error: true,
			};
		}

		// Check if TextNode with the same name already exists
		const existing = parent.children.find(
			(node) => node.type === NodeType.Text && node.name === textName,
		) as TextNode;

		if (existing) {
			return { data: existing, error: false };
		}

		const textNode: TextNode = {
			children: [],
			name: textName,
			parent: parent,
			status: NodeStatus.NotStarted,
			type: NodeType.Text,
		};

		parent.children.push(textNode);

		return { data: textNode, error: false };
	}

	getParentChain({ path }: { path: TreePath }): BranchNode[] {
		// Base case: stop at root level (path length 1)
		if (path.length <= 1) {
			return [];
		}

		const parent = this.getParentNode({ path });
		if (parent.error) {
			return [];
		}

		// Only include BranchNodes in the chain, not the tree root
		if ("children" in parent.data && parent.data !== this.root) {
			return [
				parent.data as BranchNode,
				...this.getParentChain({ path: path.slice(0, -1) as TreePath }),
			];
		}

		return [];
	}

	private getTextNodesFromNode(node: BranchNode): TextNode[] {
		const textNodes: TextNode[] = [];

		function textFindingDfs(node: BranchNode) {
			if (node.type === NodeType.Text) {
				textNodes.push(node as TextNode);
			} else if (node.type === NodeType.Section) {
				for (const child of (node as SectionNode).children) {
					textFindingDfs(child);
				}
			}
		}

		textFindingDfs(node);
		return textNodes;
	}

	private initializeParents(): void {
		for (const child of this.root.children) {
			child.parent = null;
			this.setChildParents(child);
		}
	}

	private setChildParents(node: BranchNode): void {
		if (node.type === NodeType.Section) {
			const section = node as SectionNode;
			for (const child of section.children) {
				child.parent = node;
				this.setChildParents(child);
			}
		} else if (node.type === NodeType.Text) {
			const text = node as TextNode;
			for (const page of text.children) {
				page.parent = node;
			}
		}
	}

	/**
	 * Recomputes statuses for all nodes in the tree starting from the bottom.
	 * Returns the closest to root node that had its status changed, or null if no changes.
	 */
	public recomputeStatuses(): BranchNode | null {
		let closestChangedNode: BranchNode | null = null;

		// Compute statuses for all nodes bottom-up
		for (const child of this.root.children) {
			const changed = this.computeNodeStatusBottomUp(child);
			if (changed && !closestChangedNode) {
				closestChangedNode = changed;
			}
		}

		return closestChangedNode;
	}

	/**
	 * Computes status for a single node and its ancestors bottom-up.
	 * Returns the first (closest to root) node whose status changed.
	 */
	private computeNodeStatusBottomUp(node: BranchNode): BranchNode | null {
		let closestChangedNode: BranchNode | null = null;

		// First, recursively compute statuses for all children
		if (node.type === NodeType.Section) {
			const section = node as SectionNode;
			for (const child of section.children) {
				const changed = this.computeNodeStatusBottomUp(child);
				if (changed && !closestChangedNode) {
					closestChangedNode = changed;
				}
			}
		}

		// Then compute status for this node based on its children
		const oldStatus = node.status;
		const newStatus = this.computeNodeStatus(node);

		if (oldStatus !== newStatus) {
			node.status = newStatus;
			// If this node's status changed, update parent chain
			if (node.parent) {
				const parentChanged = this.computeNodeStatusBottomUp(
					node.parent,
				);
				if (parentChanged && !closestChangedNode) {
					closestChangedNode = parentChanged;
				}
			}
			// Return the current node as the closest changed if no child changed
			if (!closestChangedNode) {
				closestChangedNode = node;
			}
		}

		return closestChangedNode;
	}

	/**
	 * Computes the status of a single node based on its children's statuses.
	 * Rules:
	 * - Text node: all pages Done → Done, all pages NotStarted → NotStarted, otherwise → InProgress
	 * - Section node: all children Done → Done, all children NotStarted → NotStarted, otherwise → InProgress
	 */
	private computeNodeStatus(node: BranchNode): NodeStatus {
		if (node.type === NodeType.Text) {
			const textNode = node as TextNode;
			if (textNode.children.length === 0) {
				return NodeStatus.NotStarted;
			}

			const allDone = textNode.children.every(
				(page) => page.status === NodeStatus.Done,
			);
			const allNotStarted = textNode.children.every(
				(page) => page.status === NodeStatus.NotStarted,
			);

			if (allDone) return NodeStatus.Done;
			if (allNotStarted) return NodeStatus.NotStarted;
			return NodeStatus.InProgress;
		}
		if (node.type === NodeType.Section) {
			const section = node as SectionNode;
			if (section.children.length === 0) {
				return NodeStatus.NotStarted;
			}

			const allDone = section.children.every(
				(child) => child.status === NodeStatus.Done,
			);
			const allNotStarted = section.children.every(
				(child) => child.status === NodeStatus.NotStarted,
			);

			if (allDone) return NodeStatus.Done;
			if (allNotStarted) return NodeStatus.NotStarted;
			return NodeStatus.InProgress;
		}

		return NodeStatus.NotStarted;
	}
}
