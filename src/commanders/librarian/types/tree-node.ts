import z from "zod";
import type { Prettify } from "../../../types/helpers";
import {
	DONE_STATUS,
	FILE_NODE_TYPE,
	NOT_STARTED_STATUS,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
	UNKNOWN_STATUS,
} from "./literals";

const TreeNodeStatusSchema = z.enum([
	DONE_STATUS,
	NOT_STARTED_STATUS,
	UNKNOWN_STATUS,
]);

export type TreeNodeStatus = z.infer<typeof TreeNodeStatusSchema>;
export const TreeNodeStatus = TreeNodeStatusSchema.enum;

const TreeNodeTypeSchema = z.enum([
	FILE_NODE_TYPE,
	SCROLL_NODE_TYPE,
	SECTION_NODE_TYPE,
]);

export type TreeNodeType = z.infer<typeof TreeNodeTypeSchema>;
export const TreeNodeType = TreeNodeTypeSchema.enum;

export type NodeName = string;

/**
 * ScrollNode represents a markdown file in the tree.
 * Note: TFile references are NOT stored because they become stale when files are renamed/moved.
 * Obsidian does not automatically update TFile.path, so tRefs are resolved on-demand when needed.
 */
export type ScrollNode = {
	nodeName: NodeName;
	type: typeof TreeNodeType.Scroll;
	nodeNameChainToParent: NodeName[];
	status: TreeNodeStatus;
	extension: "md";
};

/**
 * FileNode represents a non-markdown file in the tree.
 * Note: TFile references are NOT stored because they become stale when files are renamed/moved.
 * Obsidian does not automatically update TFile.path, so tRefs are resolved on-demand when needed.
 */
export type FileNode = {
	nodeName: NodeName;
	type: typeof TreeNodeType.File;
	nodeNameChainToParent: NodeName[];
	status: typeof TreeNodeStatus.Unknown;
	extension: string;
};

export type LeafNode = ScrollNode | FileNode;

export type SectionNode = {
	nodeName: NodeName;
	nodeNameChainToParent: NodeName[];
	type: typeof TreeNodeType.Section;
	status: TreeNodeStatus;
	children: TreeNode[];
};

export type TreeNode = Prettify<
	(ScrollNode | FileNode | SectionNode) & {
		status: TreeNodeStatus;
		type: TreeNodeType;
	}
>;

export type TreeLeaf = ScrollNode | FileNode;
