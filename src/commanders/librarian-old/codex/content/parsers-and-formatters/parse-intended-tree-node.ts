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
import { makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex } from "../../../naming/functions/codexes";
import { separateJoinedSuffixedBasename } from "../../../naming/types/transformers";
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

export function parseIntendedTreeNode<T extends CodexLineType>(
	codexLine: TypedCodexLine<T>,
): IntendedTreeNode<T> {
	switch (codexLine.type) {
		case CodexLineType.Scroll:
			return parseTreeNodeIntendedForScrollLine(
				codexLine.line as CodexLineForScroll,
			) as IntendedTreeNode<T>;
		case CodexLineType.File:
			return parseTreeNodeIntendedForFileLine(
				codexLine.line as CodexLineForFile,
			) as IntendedTreeNode<T>;
		case CodexLineType.ChildSectionCodex:
			return parseTreeNodeIntendedForChildSectionCodexLine(
				codexLine.line as CodexLineForChildSectionCodex,
			) as IntendedTreeNode<T>;
		case CodexLineType.ParentSectionCodex:
			return parseTreeNodeIntendedForParentSectionCodexLine(
				codexLine.line as CodexLineForParentSectionCodex,
			) as IntendedTreeNode<T>;
	}
}

function parseTreeNodeIntendedForScrollLine(
	codexLine: CodexLineForScroll,
): TreeNodeIntendedForScrollLine {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const backlink = extractBacklinkFromRegularLine(codexLine);
	const { filename, displayName } = parseBacklink(backlink);
	const separated = separateJoinedSuffixedBasename(filename);

	// For Scroll/File, basename is like "Note-Parent", not codex format
	// Parent chain is the reversed suffix
	const parentChainWithoutLibraryRoot = [...separated.splitSuffix].reverse();

	// Add library root (internal representation includes it)
	const nodeNameChainToParent = [
		libraryRoot,
		...parentChainWithoutLibraryRoot,
	];

	const isDone = codexLine.startsWith(DONE_CHECKBOX);
	const status = isDone ? TreeNodeStatus.Done : TreeNodeStatus.NotStarted;

	return {
		node: {
			extension: "md",
			nodeName: displayName,
			nodeNameChainToParent,
			status,
			type: "Scroll",
		},
		type: CodexLineType.Scroll,
	};
}

function parseTreeNodeIntendedForFileLine(
	codexLine: CodexLineForFile,
): TreeNodeIntendedForFileLine {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const backlink = extractBacklinkFromRegularLine(codexLine);
	const { filename, displayName } = parseBacklink(backlink);
	const separated = separateJoinedSuffixedBasename(filename);

	// For Scroll/File, basename is like "Note-Parent", not codex format
	// Parent chain is the reversed suffix
	const parentChainWithoutLibraryRoot = [...separated.splitSuffix].reverse();

	// Add library root (internal representation includes it)
	const nodeNameChainToParent = [
		libraryRoot,
		...parentChainWithoutLibraryRoot,
	];

	const extensionMatch = filename.match(/\.([^.]+)$/);
	const extension = extensionMatch?.[1] || "";

	return {
		node: {
			extension,
			nodeName: displayName,
			nodeNameChainToParent,
			status: TreeNodeStatus.Unknown,
			type: "File",
		},
		type: CodexLineType.File,
	};
}

function parseTreeNodeIntendedForChildSectionCodexLine(
	codexLine: CodexLineForChildSectionCodex,
): TreeNodeIntendedForChildSectionCodexLine {
	const backlink = extractBacklinkFromRegularLine(codexLine);
	const { filename, displayName } = parseBacklink(backlink);
	const separated = separateJoinedSuffixedBasename(filename);
	const nodeNameChainToParent =
		makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex(
			separated,
		);

	const isDone = codexLine.startsWith(DONE_CHECKBOX);
	const status = isDone ? TreeNodeStatus.Done : TreeNodeStatus.NotStarted;

	return {
		node: {
			nodeName: displayName,
			nodeNameChainToParent,
			status,
			type: "Section",
		},
		type: CodexLineType.ChildSectionCodex,
	};
}

function parseTreeNodeIntendedForParentSectionCodexLine(
	codexLine: CodexLineForParentSectionCodex,
): TreeNodeIntendedForParentSectionCodexLine {
	const backlink = codexLine;
	const { filename, displayName } = parseBacklink(backlink);
	const separated = separateJoinedSuffixedBasename(filename);
	const nodeNameChainToParent =
		makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex(
			separated,
		);

	return {
		node: {
			nodeName: displayName,
			nodeNameChainToParent,
			status: TreeNodeStatus.NotStarted,
			type: "Section",
		},
		type: CodexLineType.ParentSectionCodex,
	};
}

function extractBacklinkFromRegularLine(line: string): string {
	if (
		line.startsWith(DONE_CHECKBOX) ||
		line.startsWith(NOT_STARTED_CHECKBOX)
	) {
		const checkboxLength = line.startsWith(DONE_CHECKBOX)
			? DONE_CHECKBOX.length
			: NOT_STARTED_CHECKBOX.length;
		return line.slice(checkboxLength + SPACE_F.length);
	}
	if (line.startsWith(DASH)) {
		return line.slice(DASH.length + SPACE_F.length);
	}
	return line;
}

function parseBacklink(backlink: string): {
	filename: string;
	displayName: string;
} {
	const inner = backlink.slice(
		OBSIDIAN_LINK_OPEN.length,
		backlink.length - OBSIDIAN_LINK_CLOSE.length,
	);

	if (inner.includes(`${PIPE}${BACK_ARROW}${SPACE_F}`)) {
		const parts = inner.split(`${PIPE}${BACK_ARROW}${SPACE_F}`);
		return {
			displayName: parts[1] || "",
			filename: parts[0] || "",
		};
	}

	const parts = inner.split(PIPE);
	return {
		displayName: parts[1] || "",
		filename: parts[0] || "",
	};
}
