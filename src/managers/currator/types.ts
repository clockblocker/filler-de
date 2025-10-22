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
import type { toGuardedNodeName } from "./pure-functions/naming";

// Naming
export const IndexedFileTypeSchema = z.enum([TEXT, CODEX, UNMARKED]);
export type IndexedFileType = z.infer<typeof IndexedFileTypeSchema>;
export const IndexedFileType = IndexedFileTypeSchema.enum;

export type GuardedNodeName = ReturnType<typeof toGuardedNodeName>;

// Tree
export const NodeStatusSchema = z.enum([DONE, NOT_STARTED, IN_PROGRESS]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export const NodeStatus = NodeStatusSchema.enum;

export const NodeTypeSchema = z.enum([TEXT, SECTION, PAGE]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
export const NodeType = NodeTypeSchema.enum;

export type CommonNode = {
  status: NodeStatus;
  type: NodeType;
  parent: BranchNode | null;
};

export type PageNode = CommonNode & {
  type: typeof NodeType.Page;
  index: number;
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

type TargetNodeName = GuardedNodeName;
type PrevNodeNames = GuardedNodeName[];

export type TreePath = [...PrevNodeNames, TargetNodeName];

export type SerializedText = {
  path: TreePath;
  pageStatuses: NodeStatus[];
};
