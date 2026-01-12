import type { NodeName } from "../../../../../../types/schemas/node-name";
import {
	type FileExtension,
	type MdExtension,
	TreeNodeKind,
	TreeNodeStatus,
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
	const type = parts[1] as TreeNodeKind;

	switch (type) {
		case TreeNodeKind.Section: {
			return {
				children: {},
				kind: TreeNodeKind.Section,
				nodeName,
			};
		}

		case TreeNodeKind.Scroll: {
			const extension = parts[2] as MdExtension;
			return {
				extension,
				kind: TreeNodeKind.Scroll,
				nodeName,
				status: TreeNodeStatus.Unknown,
			};
		}

		case TreeNodeKind.File: {
			const extension = parts[2] as FileExtension;
			return {
				extension,
				kind: TreeNodeKind.File,
				nodeName,
				status: TreeNodeStatus.Unknown,
			};
		}
	}
}
