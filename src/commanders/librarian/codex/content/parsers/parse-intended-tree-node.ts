import { ok } from "assert";
import type { IntendedTreeNode } from "../schema/intended-tree-node";
import type { TypedCodexLine } from "../schema/line";
import { CodexLineType } from "../schema/literals";

function parseTreeNodeIntendedForScrollLine(
	codexLine: TypedCodexLine<CodexLineType.Scroll>,
): IntendedTreeNode<CodexLineType.Scroll> {}

function parseTreeNodeIntendedForFileLine(
	codexLine: TypedCodexLine<CodexLineType.File>,
): IntendedTreeNode<CodexLineType.File> {}

function parseTreeNodeIntendedForChildSectionCodexLine(
	codexLine: TypedCodexLine<CodexLineType.ChildSectionCodex>,
): IntendedTreeNode<CodexLineType.ChildSectionCodex> {}

function parseTreeNodeIntendedForParentSectionCodexLine(
	codexLine: TypedCodexLine<CodexLineType.ParentSectionCodex>,
): IntendedTreeNode<CodexLineType.ParentSectionCodex> {}

export function parseIntendedTreeNode<T extends CodexLineType>(
	codexLine: TypedCodexLine<T>,
): IntendedTreeNode<T> {
	switch (codexLine.type) {
		case CodexLineType.Scroll:
			return parseTreeNodeIntendedForScrollLine(
				codexLine,
			) as IntendedTreeNode<T>;
		case CodexLineType.File:
			return parseTreeNodeIntendedForFileLine(
				codexLine,
			) as IntendedTreeNode<T>;
		case CodexLineType.ChildSectionCodex:
			return parseTreeNodeIntendedForChildSectionCodexLine(
				codexLine,
			) as IntendedTreeNode<T>;
		case CodexLineType.ParentSectionCodex:
			return parseTreeNodeIntendedForParentSectionCodexLine(
				codexLine,
			) as IntendedTreeNode<T>;
	}
}
