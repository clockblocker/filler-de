import { TreeNodeKind } from "../../types/atoms";
import {
	type FileNodeSegmentId,
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "../../types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "../../types/tree-node";

export function makeNodeSegmentId(node: SectionNode): SectionNodeSegmentId;
export function makeNodeSegmentId(node: ScrollNode): ScrollNodeSegmentId;
export function makeNodeSegmentId(node: FileNode): FileNodeSegmentId;
export function makeNodeSegmentId(node: TreeNode): TreeNodeSegmentId {
	switch (node.kind) {
		case TreeNodeKind.Section: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`;
		}

		case TreeNodeKind.Scroll: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}${node.extension}`;
		}

		case TreeNodeKind.File: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.File}${NodeSegmentIdSeparator}${node.extension}`;
		}
	}
}
