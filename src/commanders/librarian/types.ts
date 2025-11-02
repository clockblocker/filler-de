import { z } from "zod";
import type { TextStatus } from "../../types/common-interface/enums";
import {
	BOOK,
	CODEX,
	PAGE,
	SCROLL,
	SECTION,
	TEXT,
	UNMARKED,
} from "../../types/literals";
import type { GuardedNodeName } from "./formatters";

// Naming
export const IndexedFileTypeSchema = z.enum([
	BOOK,
	SCROLL,
	CODEX,
	PAGE,
	UNMARKED,
]);
export type IndexedFileType = z.infer<typeof IndexedFileTypeSchema>;
export const IndexedFileType = IndexedFileTypeSchema.enum;

// Tree
export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type TreePath = GuardedNodeName[];

export type CommonNode = {
	name: GuardedNodeName;
	status: TextStatus;
	type: NodeType;
	parent: BranchNode | null;
};

export type PageNode = CommonNode & {
	type: typeof NodeType.Page;
};

export type BookNode = CommonNode & {
	type: typeof NodeType.Text;
	children: PageNode[];
};

export type SectionNode = CommonNode & {
	type: typeof NodeType.Section;
	children: (SectionNode | BookNode)[];
};

export type BranchNode = SectionNode | BookNode;
export type TreeNode = BranchNode | PageNode;

export type TextNode = BookNode;
export type LeafNode = PageNode;

export type PageDto = Pick<PageNode, "name" | "status"> & {
	pathToParent: TreePath;
};

export type TextDto = {
	path: TreePath;
	pageStatuses: Record<CommonNode["name"], CommonNode["status"]>;
};
