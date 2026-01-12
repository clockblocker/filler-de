/**
 * Test helpers for Healer.
 * Provides factory and snapshot utilities for easy testing.
 */

import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../src/commanders/librarian-new/codecs";
import { Healer } from "../../../../src/commanders/librarian-new/healer/healer";
import { Tree } from "../../../../src/commanders/librarian-new/healer/library-tree/tree";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/target-chains";
import { makeNodeSegmentId } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind, TreeNodeStatus } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import type { LeafNode, SectionNode } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../src/commanders/librarian-new/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

// ─── Shape Types ───

export type LeafShape = {
	kind: "Scroll" | "File";
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
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	const tree = new Tree(shape.libraryRoot, codecs);
	const root = tree.getRoot();

	if (shape.children) {
		populateSection(root, shape.children);
	}

	return new Healer(tree, codecs);
}

function populateSection(
	section: SectionNode,
	children: Record<string, SectionShape | LeafShape>,
): void {
	for (const [name, childShape] of Object.entries(children)) {
		if (isLeafShape(childShape)) {
			const leaf = makeLeafFromShape(name as NodeName, childShape);
			const segId =
				leaf.kind === TreeNodeKind.Scroll
					? makeNodeSegmentId(leaf)
					: makeNodeSegmentId(leaf);
			section.children[segId] = leaf;
		} else {
			const childSection: SectionNode = {
				children: {},
				kind: TreeNodeKind.Section,
				nodeName: name as NodeName,
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
		"kind" in shape && (shape.kind === "Scroll" || shape.kind === "File")
	);
}

function makeLeafFromShape(name: NodeName, shape: LeafShape): LeafNode {
	if (shape.kind === "Scroll") {
		return {
			extension: "md",
			kind: TreeNodeKind.Scroll,
			nodeName: name,
			status: shape.status ?? TreeNodeStatus.NotStarted,
		};
	}
	return {
		extension: shape.extension ?? "txt",
		kind: TreeNodeKind.File,
		nodeName: name,
		status: TreeNodeStatus.Unknown,
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
		if (child.kind === TreeNodeKind.Section) {
			result[child.nodeName] = {
				children: sectionChildrenToShape(child),
			};
		} else if (child.kind === TreeNodeKind.Scroll) {
			result[child.nodeName] = {
				kind: "Scroll",
				status: child.status,
			};
		} else {
			result[child.nodeName] = {
				extension: child.extension,
				kind: "File",
			};
		}
	}

	return result;
}

// ─── Locator Builders (for tests) ───

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
		targetKind: TreeNodeKind.Scroll,
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
		targetKind: TreeNodeKind.File,
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
		targetKind: TreeNodeKind.Section,
	};
}
