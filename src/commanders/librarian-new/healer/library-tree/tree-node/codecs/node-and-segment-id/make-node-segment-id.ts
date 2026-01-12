import type { SegmentIdOf } from "../../../../../../codecs/segment-id/types";
import {
	NodeSegmentIdSeparator,
	type TreeNodeSegmentId,
} from "../../../../../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../../types/atoms";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "../../types/tree-node";

export function makeNodeSegmentId(
	node: SectionNode,
): SegmentIdOf<TreeNodeKind.Section>;
export function makeNodeSegmentId(
	node: ScrollNode,
): SegmentIdOf<TreeNodeKind.Scroll>;
export function makeNodeSegmentId(
	node: FileNode,
): SegmentIdOf<TreeNodeKind.File>;
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
