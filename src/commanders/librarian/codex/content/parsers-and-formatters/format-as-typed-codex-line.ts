import { getParsedUserSettings } from "../../../../../global-state/global-state";
import {
	BACK_ARROW,
	DASH,
	DONE_CHECKBOX,
	NOT_STARTED_CHECKBOX,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../../../types/literals";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "../../../naming/functions/basename-and-chain";
import { makeCanonicalBasenameForCodexFromSectionNode } from "../../../naming/functions/codexes";
import { TreeNodeStatus } from "../../../types/tree-node";
import type {
	IntendedTreeNode,
	TreeNodeIntendedForChildSectionCodexLine,
	TreeNodeIntendedForFileLine,
	TreeNodeIntendedForParentSectionCodexLine,
	TreeNodeIntendedForScrollLine,
} from "../schema/intended-tree-node";
import type {
	CodexLineForChildSectionCodex,
	CodexLineForFile,
	CodexLineForParentSectionCodex,
	CodexLineForScroll,
	TypedCodexLine,
} from "../schema/line";
import { CodexLineType } from "../schema/literals";

export function formatAsTypedCodexLine<T extends CodexLineType>(
	node: IntendedTreeNode<T>,
): TypedCodexLine<T> {
	switch (node.type) {
		case CodexLineType.Scroll:
			return formatAsCodexLineForScroll(node) as TypedCodexLine<T>;
		case CodexLineType.File:
			return formatAsCodexLineForFile(node) as TypedCodexLine<T>;
		case CodexLineType.ChildSectionCodex:
			return formatAsCodexLineForChildSectionCodex(
				node,
			) as TypedCodexLine<T>;
		case CodexLineType.ParentSectionCodex:
			return formatAsCodexLineForParentSectionCodex(
				node,
			) as TypedCodexLine<T>;
	}
}

function formatBacklink(basename: string, displayName: string): string {
	return `${OBSIDIAN_LINK_OPEN}${basename}${PIPE}${displayName}${OBSIDIAN_LINK_CLOSE}`;
}

function formatParentBacklink(basename: string, displayName: string): string {
	return formatBacklink(basename, `${BACK_ARROW}${SPACE_F}${displayName}`);
}

function formatAsCodexLineForScroll(
	node: TreeNodeIntendedForScrollLine,
): TypedCodexLine<typeof CodexLineType.Scroll> {
	const { node: treeNode } = node;
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const nodeNameChainToParent = treeNode.nodeNameChainToParent;
	const nodeName = treeNode.nodeName;

	// Strip library root before formatting (user-visible format should not include it)
	const fullChain = [...nodeNameChainToParent, nodeName];
	const chainWithoutLibraryRoot =
		fullChain.length > 0 && fullChain[0] === libraryRoot
			? fullChain.slice(1)
			: fullChain;

	const basename = makeJoinedSuffixedBasenameFromNodeNameChain(
		chainWithoutLibraryRoot,
	);
	const regularBacklink = formatBacklink(basename, nodeName);
	const checkbox =
		treeNode.status === TreeNodeStatus.Done
			? DONE_CHECKBOX
			: NOT_STARTED_CHECKBOX;

	return {
		line: `${checkbox}${SPACE_F}${regularBacklink}` as CodexLineForScroll,
		type: CodexLineType.Scroll,
	};
}

function formatAsCodexLineForFile(
	node: TreeNodeIntendedForFileLine,
): TypedCodexLine<typeof CodexLineType.File> {
	const { node: treeNode } = node;
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const nodeNameChainToParent = treeNode.nodeNameChainToParent;
	const nodeName = treeNode.nodeName;

	// Strip library root before formatting (user-visible format should not include it)
	const fullChain = [...nodeNameChainToParent, nodeName];
	const chainWithoutLibraryRoot =
		fullChain.length > 0 && fullChain[0] === libraryRoot
			? fullChain.slice(1)
			: fullChain;

	const basename = makeJoinedSuffixedBasenameFromNodeNameChain(
		chainWithoutLibraryRoot,
	);
	const regularBacklink = formatBacklink(basename, nodeName);

	return {
		line: `${DASH}${SPACE_F}${regularBacklink}` as CodexLineForFile,
		type: CodexLineType.File,
	};
}

function formatAsCodexLineForChildSectionCodex(
	node: TreeNodeIntendedForChildSectionCodexLine,
): TypedCodexLine<typeof CodexLineType.ChildSectionCodex> {
	const { node: treeNode } = node;
	const nodeName = treeNode.nodeName;

	const basename = makeCanonicalBasenameForCodexFromSectionNode(treeNode);
	const regularBacklink = formatBacklink(basename, nodeName);
	const checkbox =
		treeNode.status === TreeNodeStatus.Done
			? DONE_CHECKBOX
			: NOT_STARTED_CHECKBOX;

	return {
		line: `${checkbox}${SPACE_F}${regularBacklink}` as CodexLineForChildSectionCodex,
		type: CodexLineType.ChildSectionCodex,
	};
}

function formatAsCodexLineForParentSectionCodex(
	node: TreeNodeIntendedForParentSectionCodexLine,
): TypedCodexLine<typeof CodexLineType.ParentSectionCodex> {
	const { node: treeNode } = node;
	const nodeName = treeNode.nodeName;

	const basename = makeCanonicalBasenameForCodexFromSectionNode(treeNode);
	const parentBacklink = formatParentBacklink(basename, nodeName);

	return {
		line: parentBacklink as CodexLineForParentSectionCodex,
		type: CodexLineType.ParentSectionCodex,
	};
}
