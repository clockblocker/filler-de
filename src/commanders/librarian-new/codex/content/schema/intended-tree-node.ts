import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../types/tree-node";
import type { CodexLineType } from "./literals";

// Object schemas with type discriminator
export type TreeNodeIntendedForScrollLine = {
	type: typeof CodexLineType.Scroll;
	node: ScrollNode;
};

export type TreeNodeIntendedForFileLine = {
	type: typeof CodexLineType.File;
	node: FileNode;
};

export type TreeNodeIntendedForChildSectionCodexLine = {
	type: typeof CodexLineType.ChildSectionCodex;
	node: Omit<SectionNode, "children">;
};

export type TreeNodeIntendedForParentSectionCodexLine = {
	type: typeof CodexLineType.ParentSectionCodex;
	node: Omit<SectionNode, "children">;
};

// Combined schema using discriminated union
export type AnyIntendedTreeNode =
	| TreeNodeIntendedForScrollLine
	| TreeNodeIntendedForFileLine
	| TreeNodeIntendedForChildSectionCodexLine
	| TreeNodeIntendedForParentSectionCodexLine;

export type IntendedTreeNode<T extends CodexLineType> =
	T extends typeof CodexLineType.Scroll
		? TreeNodeIntendedForScrollLine
		: T extends typeof CodexLineType.File
			? TreeNodeIntendedForFileLine
			: T extends typeof CodexLineType.ChildSectionCodex
				? TreeNodeIntendedForChildSectionCodexLine
				: T extends typeof CodexLineType.ParentSectionCodex
					? TreeNodeIntendedForParentSectionCodexLine
					: never;
