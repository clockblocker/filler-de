import type { TFile, TFolder } from "obsidian";
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

export type CoreName = string;

export type ScrollNode = {
	coreName: CoreName;
	type: typeof TreeNodeType.Scroll;
	coreNameChainToParent: CoreName[];
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted;
	tRef: TFile;
};

export type FileNode = {
	coreName: CoreName;
	type: typeof TreeNodeType.File;
	coreNameChainToParent: CoreName[];
	status: typeof TreeNodeStatus.Unknown;
	tRef: TFile;
};

export type LeafNode = ScrollNode | FileNode;

export type SectionNode = {
	coreName: CoreName;
	coreNameChainToParent: CoreName[];
	type: typeof TreeNodeType.Section;
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted;
	children: TreeNode[];
};

export type TreeNode = Prettify<
	(ScrollNode | FileNode | SectionNode) & {
		status: TreeNodeStatus;
		type: TreeNodeType;
	}
>;
