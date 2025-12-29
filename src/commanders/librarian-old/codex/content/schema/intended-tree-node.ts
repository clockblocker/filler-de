import type {
	FileNodeDeprecated,
	ScrollNodeDeprecated,
	SectionNodeDeprecated,
} from "../../../types/tree-node";
import type { CodexLineType } from "./literals";

// Object schemas with type discriminator
export type TreeNodeIntendedForScrollLine = {
	type: typeof CodexLineType.Scroll;
	node: ScrollNodeDeprecated;
};

export type TreeNodeIntendedForFileLine = {
	type: typeof CodexLineType.File;
	node: FileNodeDeprecated;
};

export type TreeNodeIntendedForChildSectionCodexLine = {
	type: typeof CodexLineType.ChildSectionCodex;
	node: Omit<SectionNodeDeprecated, "children">;
};

export type TreeNodeIntendedForParentSectionCodexLine = {
	type: typeof CodexLineType.ParentSectionCodex;
	node: Omit<SectionNodeDeprecated, "children">;
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
