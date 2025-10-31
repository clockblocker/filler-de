import { z } from "zod";
import {
	BOOK,
	CODEX,
	DONE,
	IN_PROGRESS,
	NOT_STARTED,
	PAGE,
	SCROLL,
	SECTION,
	UNMARKED,
} from "../../types/literals";
import type { GuardedNodeName } from "./formatters";

// Naming
export const IndexedFileTypeSchema = z.enum([BOOK, SCROLL, CODEX, UNMARKED]);
export type IndexedFileType = z.infer<typeof IndexedFileTypeSchema>;
export const IndexedFileType = IndexedFileTypeSchema.enum;

// Tree
export const NodeStatusSchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export const NodeStatus = NodeStatusSchema.enum;

export const NodeTypeSchema = z.enum([BOOK, SCROLL, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type TreePath = GuardedNodeName[];

export type CommonNode = {
	name: GuardedNodeName;
	status: NodeStatus;
	type: NodeType;
	parent: BranchNode | null;
};

export type ScrollNode = CommonNode & {
	type: typeof NodeType.Scroll;
};

export type PageNode = CommonNode & {
	type: typeof NodeType.Page;
};

export type BookNode = CommonNode & {
	type: typeof NodeType.Book;
	children: PageNode[];
};

export type SectionNode = CommonNode & {
	type: typeof NodeType.Section;
	children: (SectionNode | BookNode | ScrollNode)[];
};

export type BranchNode = SectionNode | BookNode;
export type TreeNode = BranchNode | PageNode | ScrollNode;

export type TextNode = ScrollNode | BookNode;
export type LeafNode = PageNode | ScrollNode;

export type SerializedText = {
	path: TreePath;
	pageStatuses: Record<CommonNode["name"], CommonNode["status"]>;
};
