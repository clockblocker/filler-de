import { TreeNodeType } from "../../types/atoms";
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
	switch (node.type) {
		case TreeNodeType.Section: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`;
		}

		case TreeNodeType.Scroll: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}${node.extension}`;
		}

		case TreeNodeType.File: {
			return `${node.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}${node.extension}`;
		}
	}
}
