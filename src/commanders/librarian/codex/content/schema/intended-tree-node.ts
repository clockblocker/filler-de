import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../types/tree-node";
import type { CodexLineType } from "./literals";

// Object schemas with type discriminator
export type TreeNodeIntendedForScrollLine = {
	type: typeof CodexLineType.Scroll;
	value: ScrollNode;
};

export type TreeNodeIntendedForFileLine = {
	type: typeof CodexLineType.File;
	value: FileNode;
};

export type TreeNodeIntendedForChildSectionCodexLine = {
	type: typeof CodexLineType.ChildSectionCodex;
	value: SectionNode;
};

export type TreeNodeIntendedForParentSectionCodexLine = {
	type: typeof CodexLineType.ParentSectionCodex;
	value: SectionNode;
};

// Combined schema using discriminated union
export type IntendedTreeNode =
	| TreeNodeIntendedForScrollLine
	| TreeNodeIntendedForFileLine
	| TreeNodeIntendedForChildSectionCodexLine
	| TreeNodeIntendedForParentSectionCodexLine;
