/**
 * Test helpers for Healer.
 * Provides factory and snapshot utilities for easy testing.
 */

import type { NodeName } from "../../types/schemas/node-name";
import { Healer } from "../healer";
import { Tree } from "./tree";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import type { LeafNode, SectionNode } from "./tree-node/types/tree-node";

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

export function makeTree(shape: TreeShape): Healer {
	const tree = new Tree(shape.libraryRoot);
	const root = tree.getRoot();

	if (shape.children) {
		populateSection(root, shape.children);
	}

	return new Healer(tree);
}

function populateSection(
	section: SectionNode,
	children: Record<string, SectionShape | LeafShape>,
): void {
	for (const [name, childShape] of Object.entries(children)) {
		if (isLeafShape(childShape)) {
			const leaf = makeLeafFromShape(name as NodeName, childShape);
			const segId =
				leaf.type === TreeNodeType.Scroll
					? makeNodeSegmentId(leaf)
					: makeNodeSegmentId(leaf);
			section.children[segId] = leaf;
		} else {
			const childSection: SectionNode = {
				children: {},
				nodeName: name as NodeName,
				type: TreeNodeType.Section,
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
	return (
		"type" in shape && (shape.type === "Scroll" || shape.type === "File")
	);
}

function makeLeafFromShape(name: NodeName, shape: LeafShape): LeafNode {
	if (shape.type === "Scroll") {
		return {
			extension: "md",
			nodeName: name,
			status: shape.status ?? TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};
	}
	return {
		extension: shape.extension ?? "txt",
		nodeName: name,
		status: TreeNodeStatus.Unknown,
		type: TreeNodeType.File,
	};
}

// ─── Snapshot ───

export function toShape(healer: Healer): TreeShape {
	const root = healer.getRoot();
	return {
		children: sectionChildrenToShape(root),
		libraryRoot: root.nodeName,
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
				status: child.status,
				type: "Scroll",
			};
		} else {
			result[child.nodeName] = {
				extension: child.extension,
				type: "File",
			};
		}
	}

	return result;
}

// ─── Locator Builders (for tests) ───

import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./tree-action/types/target-chains";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "./tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "./tree-node/types/node-segment-id";

export function makeScrollLocator(
	pathParts: NodeName[],
	nodeName: NodeName,
): ScrollNodeLocator {
	const sep = NodeSegmentIdSeparator;
	return {
		segmentId: `${nodeName}${sep}Scroll${sep}md` as ScrollNodeSegmentId,
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
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
		segmentId:
			`${nodeName}${sep}File${sep}${extension}` as FileNodeSegmentId,
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
		targetType: TreeNodeType.File,
	};
}

export function makeSectionLocator(
	pathParts: NodeName[],
	nodeName: NodeName,
): SectionNodeLocator {
	const sep = NodeSegmentIdSeparator;
	return {
		segmentId: `${nodeName}${sep}Section${sep}` as SectionNodeSegmentId,
		segmentIdChainToParent: pathParts.map(
			(p) => `${p}${sep}Section${sep}` as SectionNodeSegmentId,
		),
		targetType: TreeNodeType.Section,
	};
}
