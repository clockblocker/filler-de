import { z } from 'zod';

// UnVettedName.strip().replaceAll(/\s+/g, '_')
export type NodeName = string;

export const NodeStatusSchema = z.enum(['Done', 'NotStarted', 'InProgress']);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export const NodeStatus = NodeStatusSchema.enum;

export const NodeTypeSchema = z.enum(['Entry', 'Section']);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type CommonNode = {
	name: NodeName;
	status: NodeStatus;
};

export type EntryNode = CommonNode & {
	numberOfPages: number;
	type: typeof NodeType.Entry;
};

export type SectionNode = CommonNode & {
	type: typeof NodeType.Section;
	children: (SectionNode | EntryNode)[];
};

export type TreeNode = SectionNode | EntryNode;

type TargetNodeName = NodeName;
type PrevNodeNames = NodeName[];

export type TreePath = [...PrevNodeNames[], TargetNodeName];
