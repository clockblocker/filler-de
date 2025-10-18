import { z } from 'zod';
import {
	SECTION,
	PAGE,
	TEXT,
	IN_PROGRESS,
	NOT_STARTED,
	DONE,
} from '../types/beta/literals';

// UnVettedName.strip().replaceAll(/\s+/g, '_')
export type NodeName = string;

export const NodeStatusSchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export const NodeStatus = NodeStatusSchema.enum;

export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type CommonNode = {
	status: NodeStatus;
};

export type PageNode = CommonNode & {
	type: typeof NodeType.Page;
	index: number;
};

export type TextNode = CommonNode & {
	name: NodeName;
	type: typeof NodeType.Text;
	children: PageNode[];
};

export type SectionNode = CommonNode & {
	name: NodeName;
	type: typeof NodeType.Section;
	children: (SectionNode | TextNode)[];
};

export type TreeNode = SectionNode | TextNode;

type TargetNodeName = NodeName;
type PrevNodeNames = NodeName[];

export type TreePath = [...PrevNodeNames, TargetNodeName];

export type SerializedText = {
	path: TreePath;
	pageStatuses: NodeStatus[];
};
