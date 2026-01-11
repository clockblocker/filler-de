import type { NodeName } from "../../../../../../types/schemas/node-name";
import {
	type FileExtension,
	type MdExtension,
	TreeNodeStatus,
	TreeNodeType,
} from "../../../types/atoms";
import {
	type FileNodeSegmentId,
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "../../../types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "../../../types/tree-node";

// INVARIANT: segmentId is validated
export function makeTreeNode(segmentId: TreeNodeSegmentId): TreeNode;
export function makeTreeNode(segmentId: SectionNodeSegmentId): SectionNode;
export function makeTreeNode(segmentId: ScrollNodeSegmentId): ScrollNode;
export function makeTreeNode(segmentId: FileNodeSegmentId): FileNode;
export function makeTreeNode(segmentId: TreeNodeSegmentId): TreeNode {
	const parts = segmentId.split(NodeSegmentIdSeparator);

	const nodeName = parts[0] as NodeName;
	const type = parts[1] as TreeNodeType;

	switch (type) {
		case TreeNodeType.Section: {
			return {
				children: {},
				nodeName,
				type: TreeNodeType.Section,
			};
		}

		case TreeNodeType.Scroll: {
			const extension = parts[2] as MdExtension;
			return {
				extension,
				nodeName,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.Scroll,
			};
		}

		case TreeNodeType.File: {
			const extension = parts[2] as FileExtension;
			return {
				extension,
				nodeName,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		}
	}
}
