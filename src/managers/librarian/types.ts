import { z } from "zod";
import {
	CODEX,
	DONE,
	IN_PROGRESS,
	NOT_STARTED,
	PAGE,
	SECTION,
	TEXT,
	UNMARKED,
} from "../../types/literals";
import type { GuardedNodeName } from "./formatters";

// Naming
export const IndexedFileTypeSchema = z.enum([TEXT, CODEX, UNMARKED]);
export type IndexedFileType = z.infer<typeof IndexedFileTypeSchema>;
export const IndexedFileType = IndexedFileTypeSchema.enum;

// Tree
export const NodeStatusSchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export const NodeStatus = NodeStatusSchema.enum;

export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type TreePath = GuardedNodeName[];

export type CommonNode = {
	status: NodeStatus;
	type: NodeType;
	parent: BranchNode | null;
};

export type PageNode = CommonNode & {
	type: typeof NodeType.Page;
	name: number;
};

export type TextNode = CommonNode & {
	name: GuardedNodeName;
	type: typeof NodeType.Text;
	children: PageNode[];
};

export type SectionNode = CommonNode & {
	name: GuardedNodeName;
	type: typeof NodeType.Section;
	children: (SectionNode | TextNode)[];
};

export type BranchNode = SectionNode | TextNode;
export type TreeNode = BranchNode | PageNode;

export type SerializedText = {
	path: TreePath;
	pageStatuses: NodeStatus[];
};
