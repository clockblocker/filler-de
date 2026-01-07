/**
 * Test helpers for LibraryTree.
 * Provides factory and snapshot utilities for easy testing.
 */

import type { NodeName } from "../types/schemas/node-name";
import { LibraryTree } from "./library-tree";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";

// ─── Shape Types ───

export type LeafShape = {
	type: "Scroll" | "File";
	status?: TreeNodeStatus;
	extension?: string;
};

export type SectionShape = {
	children?: Record<string, SectionShape | LeafShape>;
};

export type TreeShape = {
	libraryRoot: NodeName;
	children?: Record<string, SectionShape | LeafShape>;
};

// ─── Factory ───

export function makeTree(shape: TreeShape): LibraryTree {
	const tree = new LibraryTree(shape.libraryRoot);
	const root = tree.getRoot();

	if (shape.children) {
		populateSection(root, shape.children);
	}

	return tree;
}

function populateSection(
	section: SectionNode,
	children: Record<string, SectionShape | LeafShape>,
): void {
	for (const [name, childShape] of Object.entries(children)) {
		if (isLeafShape(childShape)) {
			const leaf = makeLeafFromShape(name as NodeName, childShape);
			const segId = makeNodeSegmentId(leaf);
			section.children[segId] = leaf;
		} else {
			const childSection: SectionNode = {
				nodeName: name as NodeName,
				type: TreeNodeType.Section,
				children: {},
			};
			const segId = makeNodeSegmentId(childSection);
			section.children[segId] = childSection;

			if (childShape.children) {
				populateSection(childSection, childShape.children);
			}
		}
	}
}

function isLeafShape(shape: SectionShape | LeafShape): shape is LeafShape {
	return "type" in shape && (shape.type === "Scroll" || shape.type === "File");
}

function makeLeafFromShape(name: NodeName, shape: LeafShape): LeafNode {
	if (shape.type === "Scroll") {
		return {
			nodeName: name,
			type: TreeNodeType.Scroll,
			status: shape.status ?? TreeNodeStatus.NotStarted,
			extension: "md",
		};
	}
	return {
		nodeName: name,
		type: TreeNodeType.File,
		status: TreeNodeStatus.Unknown,
		extension: shape.extension ?? "txt",
	};
}

// ─── Snapshot ───

export function toShape(tree: LibraryTree): TreeShape {
	const root = tree.getRoot();
	return {
		libraryRoot: root.nodeName,
		children: sectionChildrenToShape(root),
	};
}

function sectionChildrenToShape(
	section: SectionNode,
): Record<string, SectionShape | LeafShape> | undefined {
	const entries = Object.values(section.children);
	if (entries.length === 0) return undefined;

	const result: Record<string, SectionShape | LeafShape> = {};

	for (const child of entries) {
		if (child.type === TreeNodeType.Section) {
			result[child.nodeName] = {
				children: sectionChildrenToShape(child),
			};
		} else if (child.type === TreeNodeType.Scroll) {
			result[child.nodeName] = {
				type: "Scroll",
				status: child.status,
			};
		} else {
			result[child.nodeName] = {
				type: "File",
				extension: child.extension,
			};
		}
	}

	return result;
}

// ─── Locator Builders (for tests) ───

import { NodeSegmentIdSeparator } from "./tree-node/types/node-segment-id";
import type {
	ScrollNodeLocator,
	FileNodeLocator,
	SectionNodeLocator,
} from "./tree-action/types/target-chains";
import type {
	ScrollNodeSegmentId,
	FileNodeSegmentId,
	SectionNodeSegmentId,
} from "./tree-node/types/node-segment-id";

export function makeScrollLocator(
	pathParts: NodeName[],
	nodeName: NodeName,
): ScrollNodeLocator {
	const sep = NodeSegmentIdSeparator;
	return {
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
		segmentId: `${nodeName}${sep}Scroll${sep}md` as ScrollNodeSegmentId,
		targetType: TreeNodeType.Scroll,
	};
}

export function makeFileLocator(
	pathParts: NodeName[],
	nodeName: NodeName,
	extension: string,
): FileNodeLocator {
	const sep = NodeSegmentIdSeparator;
	return {
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
		segmentId: `${nodeName}${sep}File${sep}${extension}` as FileNodeSegmentId,
		targetType: TreeNodeType.File,
	};
}

export function makeSectionLocator(
	pathParts: NodeName[],
	nodeName: NodeName,
): SectionNodeLocator {
	const sep = NodeSegmentIdSeparator;
	return {
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
		segmentId: `${nodeName}${sep}Section${sep}` as SectionNodeSegmentId,
		targetType: TreeNodeType.Section,
	};
}

