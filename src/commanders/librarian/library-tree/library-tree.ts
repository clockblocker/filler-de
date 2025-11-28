import { TextStatus } from "../../../types/common-interface/enums";
import type { Maybe } from "../../../types/common-interface/maybe";
import type { TreeSnapshot } from "../diffing/types";
import {
	areShallowEqual,
	getNodeId,
	getTreePathFromNode,
} from "../pure-functions/node";
import {
	type LeafNode,
	NodeType,
	type PageNode,
	type SectionNode,
	type TextDto,
	type TextNode,
	type TreeNode,
	type TreePath,
} from "../types";
import { serializeTextNode } from "./helpers/serialization";
import { bfs } from "./helpers/walks";

export class LibraryTree {
	root: SectionNode;

	constructor(serializedTexts: TextDto[], name: string) {
		this.root = {
			children: [],
			name,
			parent: null,
			status: TextStatus.NotStarted,
			type: NodeType.Section,
		};

		this.addTexts(serializedTexts);
	}

	public getTexts(path: TreePath): TextDto[] {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return [];
		}

		const textNodes = this.getTextNodesFromNode(mbNode.data);
		return textNodes.map((node) => serializeTextNode(node));
	}

	public getAllTextsInTree(): TextDto[] {
		return this.getTexts([]);
	}

	/**
	 * Get all section paths in the tree (excluding root).
	 */
	public getAllSectionPaths(): TreePath[] {
		const paths: TreePath[] = [];

		const collectSections = (node: SectionNode): void => {
			for (const child of node.children) {
				if (child.type === NodeType.Section) {
					paths.push(getTreePathFromNode(child));
					collectSections(child);
				}
			}
		};

		collectSections(this.root);
		return paths;
	}

	/**
	 * Create a snapshot of current tree state for diffing.
	 */
	public snapshot(): TreeSnapshot {
		return {
			sectionPaths: this.getAllSectionPaths(),
			texts: this.getAllTextsInTree(),
		};
	}

	public addTexts(serializedTexts: TextDto[]): void {
		console.log("[LibraryTree.addTexts] Adding texts:", serializedTexts);
		for (const serializedText of serializedTexts) {
			this.addText(serializedText);
		}
		this.initializeParents();
		this.recomputeTreeStatuses();
	}

	public deleteTexts(paths: { path: TreePath }[]): void {
		for (const path of paths) {
			this.deleteText(path);
		}
		this.initializeParents();
		this.recomputeTreeStatuses();
	}

	/**
	 * Reconcile a subtree with filesystem state.
	 * Syncs the tree at the given path to match the provided TextDtos.
	 *
	 * @param subtreePath - Path to the subtree to reconcile (empty = whole tree)
	 * @param filesystemTexts - TextDtos read from filesystem for this subtree
	 */
	public reconcileSubtree(
		subtreePath: TreePath,
		filesystemTexts: TextDto[],
	): void {
		// Get current texts in tree at this path
		const currentTexts = this.getTexts(subtreePath);

		// Build sets for comparison
		const currentTextKeys = new Set(
			currentTexts.map((t) => t.path.join("/")),
		);
		const filesystemTextKeys = new Set(
			filesystemTexts.map((t) => t.path.join("/")),
		);
		const filesystemTextMap = new Map(
			filesystemTexts.map((t) => [t.path.join("/"), t]),
		);

		// Delete texts that exist in tree but not in filesystem
		const textsToDelete = currentTexts.filter(
			(t) => !filesystemTextKeys.has(t.path.join("/")),
		);
		for (const text of textsToDelete) {
			this.deleteText({ path: text.path });
		}

		// Add texts that exist in filesystem but not in tree
		const textsToAdd = filesystemTexts.filter(
			(t) => !currentTextKeys.has(t.path.join("/")),
		);
		for (const text of textsToAdd) {
			this.addText(text);
		}

		// Update statuses for texts that exist in both
		for (const currentText of currentTexts) {
			const key = currentText.path.join("/");
			const filesystemText = filesystemTextMap.get(key);
			if (!filesystemText) continue;

			// Update page statuses if different
			const mbTextNode = this.getMaybeTextNode({
				path: currentText.path,
			});
			if (mbTextNode.error) continue;

			const textNode = mbTextNode.data;
			for (const page of textNode.children) {
				const fsStatus = filesystemText.pageStatuses[page.name];
				if (fsStatus !== undefined && fsStatus !== page.status) {
					page.status = fsStatus;
				}
			}
		}

		this.initializeParents();
		this.recomputeTreeStatuses();
	}

	public getNearestSectionNode(arg: TreePath): SectionNode;
	public getNearestSectionNode(arg: TreeNode): SectionNode;
	public getNearestSectionNode(arg: TreePath | TreeNode): SectionNode {
		const mbNode = Array.isArray(arg)
			? this.getMaybeNode({ path: arg })
			: { data: arg, error: false };

		if (mbNode.error) {
			return this.root;
		}

		const node = mbNode.data;

		if (!node || !node.parent) {
			return this.root;
		}

		switch (node.type) {
			case NodeType.Page:
			case NodeType.Text:
				return this.getNearestSectionNode(node.parent);
			case NodeType.Section:
				return node;
		}
	}

	private addText(serializedText: TextDto): Maybe<TextNode> {
		console.log("[LibraryTree.addText] Adding text:", serializedText);
		const newText = this.getOrCreateTextNode(serializedText);
		if (newText.error) {
			console.log("[LibraryTree.addText] Failed:", newText.description);
		} else {
			console.log("[LibraryTree.addText] Success, created text node:", {
				childrenCount: newText.data.children.length,
				childrenNames: newText.data.children.map((c) => c.name),
				name: newText.data.name,
				type: newText.data.type,
			});
		}
		return newText;
	}

	private deleteText({ path }: { path: TreePath }): void {
		const mbTextNode = this.getMaybeTextNode({ path });
		if (mbTextNode.error) {
			return;
		}
		this.deleteNode(mbTextNode.data);
	}

	public setStatus({
		path,
		status,
	}: {
		path: TreePath;
		status: "Done" | "NotStarted";
	}): Maybe<TreeNode> {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			console.log(
				"[LibraryTree.setStatus] Node not found:",
				path,
				mbNode,
			);
			return mbNode;
		}

		const node = mbNode.data;
		console.log("[LibraryTree.setStatus] Current status:", {
			currentStatus: node.status,
			newStatus: status,
			path,
			willChange: node.status !== status,
		});
		if (node.status === status) {
			console.log(
				"[LibraryTree.setStatus] Status already matches, no change",
			);
			return { data: node, error: false };
		}

		this.setStatusOnNodeAndItsDescendants(node, status);
		this.recomputeTreeStatuses();

		return { data: node, error: false };
	}

	private setStatusOnNodeAndItsDescendants(
		node: TreeNode,
		status: TextStatus,
	): void {
		switch (node.type) {
			case NodeType.Page:
				node.status = status;
				break;
			case NodeType.Text: {
				const textNode = node;
				for (const page of textNode.children) {
					page.status = status;
				}
				break;
			}
			case NodeType.Section: {
				const section = node;
				for (const child of section.children) {
					this.setStatusOnNodeAndItsDescendants(child, status);
				}
				break;
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

	isEqualTo(other: LibraryTree): boolean {
		return this.getDiff(other).length === 0;
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<TreeNode> {
		let endOfTheChain: TreeNode = this.root;

		for (let i = 0; i < path.length; i++) {
			const name = path[i];
			if (!name) {
				return {
					description: `Node ${path.join("-")} not found: Name is undefined`,
					error: true,
				};
			}

			const mbNextInChain = this.getMaybeChildNode({
				endOfTheChain,
				name,
			});

			if (mbNextInChain.error) {
				// Log available children for debugging
				if (endOfTheChain.type !== NodeType.Page) {
					const childrenNames = endOfTheChain.children.map(
						(c) => c.name,
					);
					console.log(
						`[LibraryTree.getMaybeNode] Failed at step ${i}/${path.length}:`,
						{
							availableChildren: childrenNames,
							currentNode: endOfTheChain.name,
							currentNodeType: endOfTheChain.type,
							fullPath: path,
							lookingFor: name,
						},
					);
				}
				return {
					description: `Node ${path.join("-")} not found: ${mbNextInChain.description}`,
					error: true,
				};
			}

			endOfTheChain = mbNextInChain.data;
		}

		return { data: endOfTheChain, error: false };
	}

	public getMaybeText({ path }: { path: TreePath }): Maybe<TextNode> {
		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error) {
			if (mbNode.data.type === NodeType.Text) {
				return { data: mbNode.data, error: false };
			}
			return {
				description: `Node ${path.join("-")} is not a TextNode`,
				error: true,
			};
		}

		return { description: mbNode.description, error: true };
	}

	public getMaybePage({
		textPath,
		pageName,
	}: {
		textPath: TreePath;
		pageName: string;
	}): Maybe<PageNode> {
		const mbTextNode = this.getMaybeText({ path: textPath });
		if (mbTextNode.error) {
			return {
				description: `Text node at ${textPath.join("-")} not found: ${mbTextNode.description}`,
				error: true,
			};
		}

		const textNode = mbTextNode.data;
		if (textNode.type !== NodeType.Text) {
			return {
				description: `Node at ${textPath.join("-")} is a ScrollNode, not a TextNode. Page can only be accessed from TextNodes.`,
				error: true,
			};
		}

		const page = textNode.children.find((p) => p.name === pageName);

		if (!page) {
			return {
				description: `Page "${pageName}" not found in TextNode at ${textPath.join("-")}`,
				error: true,
			};
		}

		return { data: page, error: false };
	}

	private getMaybeTextNode({ path }: { path: TreePath }): Maybe<TextNode> {
		return this.getMaybeText({ path });
	}

	private getMaybeChildNode({
		name,
		endOfTheChain,
	}: {
		name: TreeNode["name"];
		endOfTheChain: TreeNode;
	}): Maybe<TreeNode> {
		if (endOfTheChain.type === NodeType.Page) {
			return {
				description: `Node ${endOfTheChain.name} is a leaf. It's child ${name} was looked up.`,
				error: true,
			};
		}

		const candidats = endOfTheChain.children;
		const found = candidats.find((child) => child.name === name);

		return found
			? { data: found, error: false }
			: {
					description: `Child "${name}" of node "${endOfTheChain.name}" not found`,
					error: true,
				};
	}

	getOrCreateChildSectionNode({
		parent,
		name,
	}: {
		parent: SectionNode;
		name: string;
	}): Maybe<SectionNode> {
		const found = parent.children.find((child) => child.name === name);
		if (found) {
			if (found.type === NodeType.Section) {
				return { data: found, error: false };
			}
			return {
				description: `\t[getOrCreateChildSectionNode] failed: \nChild "${name}" of node "${parent.name}" is not a SectionNode`,
				error: true,
			};
		}

		const newSectionNode = {
			children: [],
			name,
			parent,
			status: TextStatus.NotStarted,
			type: NodeType.Section,
		};
		parent.children.push(newSectionNode);
		return { data: newSectionNode, error: false };
	}

	getOrCreateTextNode({ path, pageStatuses }: TextDto): Maybe<TextNode> {
		const newTextNodeName = path[path.length - 1];

		if (path.length === 0 || !newTextNodeName) {
			return {
				description: "Path is empty",
				error: true,
			};
		}

		const mbTextNode = this.getMaybeTextNode({ path });
		if (!mbTextNode.error) {
			return mbTextNode;
		}

		let parent: SectionNode = this.root;
		for (const name of path.slice(0, -1)) {
			const mbNewSection = this.getOrCreateChildSectionNode({
				name,
				parent,
			});

			if (mbNewSection.error) {
				return {
					description: `[getOrCreateTextNode] failed to create ${path.join("-")}: \n\t${mbNewSection.description}`,
					error: true,
				};
			}

			parent = mbNewSection.data;
		}

		const pageNodes: PageNode[] = Object.entries(pageStatuses).map(
			([name, status]) => ({
				name,
				parent: null,
				status,
				type: NodeType.Page,
			}),
		);

		const textNode: TextNode = {
			children: pageNodes,
			name: newTextNodeName,
			parent: parent,
			status: TextStatus.NotStarted,
			type: NodeType.Text,
		};

		// Add the text node to its parent's children
		parent.children.push(textNode);

		for (const page of pageNodes) {
			page.parent = textNode;
		}

		return { data: textNode, error: false };
	}

	getTextNodesFromNode(node: TreeNode): TextNode[] {
		const textNodes: TextNode[] = [];

		function textFindingDfs(node: TreeNode) {
			switch (node.type) {
				case NodeType.Page:
					return;
				case NodeType.Text:
					textNodes.push(node);
					break;
				case NodeType.Section:
					for (const child of node.children) {
						textFindingDfs(child);
					}
					break;
			}
		}

		textFindingDfs(node);
		return textNodes;
	}

	initializeParents(): void {
		this.root.parent = null;
		// Root's children should point to root as their parent
		for (const child of this.root.children) {
			child.parent = this.root;
			this.setNodeChildrensParentToNode(child);
		}
	}

	setNodeChildrensParentToNode(node: TreeNode): void {
		switch (node.type) {
			case NodeType.Page:
				break;
			case NodeType.Text: {
				const textNode = node;
				for (const page of textNode.children) {
					page.parent = textNode;
				}
				break;
			}
			case NodeType.Section: {
				const section = node as SectionNode;
				for (const child of section.children) {
					child.parent = node;
					this.setNodeChildrensParentToNode(child);
				}
				break;
			}
		}
	}

	public recomputeTreeStatuses(): LeafNode[] {
		const affectedLeaves: LeafNode[] = this.recomputeStatuses(this.root);
		return affectedLeaves;
	}

	recomputeStatuses(
		node: TreeNode,
		affectedLeaves: LeafNode[] = [],
		mbCache?: Record<string, TextStatus>,
	): LeafNode[] {
		const cache = mbCache ?? this.computeNodeStatus(this.root).cache;
		const newStatus = cache[getNodeId(node)];
		const oldStatus = node.status;

		if (!newStatus) {
			return affectedLeaves;
		}

		node.status = newStatus;

		if (node.type === NodeType.Page) {
			if (newStatus !== oldStatus) {
				affectedLeaves.push(node);
			}
			return affectedLeaves;
		}

		node.children.forEach((child: TreeNode) => {
			this.recomputeStatuses(child, affectedLeaves, cache);
		});

		return affectedLeaves;
	}

	/**
	 * Computes the status of a single node based on its children's statuses.
	 * Rules:
	 * - Text node: all pages Done → Done, all pages NotStarted → NotStarted, otherwise → InProgress
	 * - Section node: all children Done → Done, all children NotStarted → NotStarted, otherwise → InProgress
	 */
	computeNodeStatus(
		node: TreeNode,
		initialCache: Record<string, TextStatus> = {},
	): {
		cache: Record<string, TextStatus>;
		status: TextStatus;
	} {
		const cache: Record<string, TextStatus> = initialCache;
		const inner = (node: TreeNode): TextStatus => {
			switch (node.type) {
				case NodeType.Page:
					return node.status;
				case NodeType.Text:
				case NodeType.Section: {
					const cached = cache[getNodeId(node)];
					if (cached) {
						return cached;
					}

					// Empty sections/books should be NotStarted
					if (node.children.length === 0) {
						const status = TextStatus.NotStarted;
						cache[getNodeId(node)] = status;
						return status;
					}

					const statuses = node.children.map((c) => inner(c));

					const allDone = statuses.every((s) => s === "Done");
					const allNotStarted = statuses.every(
						(s) => s === "NotStarted",
					);

					const status = allDone
						? TextStatus.Done
						: allNotStarted
							? TextStatus.NotStarted
							: TextStatus.InProgress;

					cache[getNodeId(node)] = status;
					return status;
				}
			}
		};

		return { cache, status: inner(node) };
	}

	deleteNode(node: TreeNode): void {
		const parent = node.parent;

		// Root node case
		if (!parent) {
			return;
		}

		// Remove from parent's children
		if (parent.type === NodeType.Section || parent.type === NodeType.Text) {
			parent.children = parent.children.filter(
				(c) => c.name !== node.name,
			) as (SectionNode | TextNode)[] | PageNode[];
		}

		// Clean up node's children
		if (node.type === NodeType.Section || node.type === NodeType.Text) {
			node.children = [];
		}

		node.parent = null;

		// Recursively delete empty parent sections (but not root)
		if (
			parent &&
			parent !== this.root &&
			parent.type === NodeType.Section
		) {
			const sectionParent = parent as SectionNode;
			if (sectionParent.children.length === 0) {
				this.deleteNode(sectionParent);
			}
		}
	}
}
