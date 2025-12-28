import { err, ok, type Result } from "neverthrow";
import {
	BACK_ARROW,
	DASH,
	DONE_CHECKBOX,
	NOT_STARTED_CHECKBOX,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../../types/literals";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "../../naming/functions/basename-and-chain";
import {
	makeCanonicalBasenameForCodexFromSectionNode,
	makeNodeNameChainToParentFromCanonicalBasenameForCodex,
} from "../../naming/functions/codexes";
import { separateJoinedSuffixedBasename } from "../../naming/types/transformers";
import { CODEX_CORE_NAME } from "../../types/literals";
import { TreeNodeStatus } from "../../types/tree-node";
import type { AnyIntendedTreeNode } from "./schema/intended-tree-node";
import type { AnyCodexLine, CodexLine } from "./schema/line";
import { CodexLineSchema } from "./schema/line";
import { CodexLineType } from "./schema/literals";

export function formatAsLine<T extends AnyIntendedTreeNode>(
	intendedTreeNode: T,
): CodexLine<T["type"]> {
	const { node, type } = intendedTreeNode;
	const nodeNameChainToParent = node.nodeNameChainToParent;
	const nodeName = node.nodeName;

	let basename: string;
	switch (type) {
		case CodexLineType.ChildSectionCodex:
		case CodexLineType.ParentSectionCodex:
			basename = makeCanonicalBasenameForCodexFromSectionNode(node);
			break;
		default:
			basename = makeJoinedSuffixedBasenameFromNodeNameChain([
				...nodeNameChainToParent,
				nodeName,
			]);
			break;
	}

	const regularBacklink = formatBacklink(basename, nodeName);

	switch (type) {
		case CodexLineType.ParentSectionCodex:
			return formatParentBacklink(basename, nodeName) as CodexLine<
				T["type"]
			>;
		case CodexLineType.Scroll:
		case CodexLineType.ChildSectionCodex: {
			const checkbox =
				node.status === TreeNodeStatus.Done
					? DONE_CHECKBOX
					: NOT_STARTED_CHECKBOX;

			return `${checkbox}${SPACE_F}${regularBacklink}` as CodexLine<
				T["type"]
			>;
		}
		case CodexLineType.File:
			return `${DASH}${SPACE_F}${regularBacklink}` as CodexLine<
				T["type"]
			>;
		default:
			throw new Error(`Unknown type: ${type}`);
	}
}

export function tryParseAsIntendedTreeNode(
	codexLine: AnyCodexLine,
): Result<AnyIntendedTreeNode, string> {
	const parseResult = CodexLineSchema.safeParse(codexLine);
	if (!parseResult.success) {
		return err(`Invalid codex line: ${parseResult.error.message}`);
	}

	const line = parseResult.data;

	// Determine type and extract backlink
	let backlink: string;
	let type: CodexLineType;
	let status:
		| typeof TreeNodeStatus.Done
		| typeof TreeNodeStatus.NotStarted
		| undefined;

	if (
		line.startsWith(DONE_CHECKBOX) ||
		line.startsWith(NOT_STARTED_CHECKBOX)
	) {
		const isDone = line.startsWith(DONE_CHECKBOX);
		status = isDone ? TreeNodeStatus.Done : TreeNodeStatus.NotStarted;
		const checkboxLength = isDone
			? DONE_CHECKBOX.length
			: NOT_STARTED_CHECKBOX.length;
		const afterCheckbox = line.slice(checkboxLength);
		if (!afterCheckbox.startsWith(SPACE_F)) {
			return err("Invalid format: missing space after checkbox");
		}
		backlink = afterCheckbox.slice(SPACE_F.length);
		// Check if it's a parent section codex (has back arrow)
		if (backlink.includes(`${PIPE}${BACK_ARROW}${SPACE_F}`)) {
			type = CodexLineType.ParentSectionCodex;
		} else {
			// Distinguish between Scroll and ChildSectionCodex by checking filename
			// Extract filename from backlink to check for codex prefix
			const backlinkInner = backlink.slice(
				OBSIDIAN_LINK_OPEN.length,
				backlink.length - OBSIDIAN_LINK_CLOSE.length,
			);
			const filenamePart = backlinkInner.split(PIPE)[0] || "";
			// ChildSectionCodex has CODEX_CORE_NAME in the filename
			if (filenamePart.includes(CODEX_CORE_NAME)) {
				type = CodexLineType.ChildSectionCodex;
			} else {
				type = CodexLineType.Scroll;
			}
		}
	} else if (line.startsWith(DASH)) {
		const afterDash = line.slice(DASH.length);
		if (!afterDash.startsWith(SPACE_F)) {
			return err("Invalid format: missing space after dash");
		}
		backlink = afterDash.slice(SPACE_F.length);
		type = CodexLineType.File;
	} else if (line.startsWith(OBSIDIAN_LINK_OPEN)) {
		backlink = line;
		type = CodexLineType.ParentSectionCodex;
	} else {
		return err(`Unknown codex line format: ${line}`);
	}

	// Extract filename and displayName from backlink
	if (
		!backlink.startsWith(OBSIDIAN_LINK_OPEN) ||
		!backlink.endsWith(OBSIDIAN_LINK_CLOSE)
	) {
		return err("Invalid backlink format");
	}

	const inner = backlink.slice(
		OBSIDIAN_LINK_OPEN.length,
		backlink.length - OBSIDIAN_LINK_CLOSE.length,
	);

	let filename: string;
	let displayName: string;

	if (inner.includes(`${PIPE}${BACK_ARROW}${SPACE_F}`)) {
		const parts = inner.split(`${PIPE}${BACK_ARROW}${SPACE_F}`);
		if (parts.length !== 2) {
			return err("Invalid parent backlink format");
		}
		filename = parts[0] || "";
		displayName = parts[1] || "";
	} else if (inner.includes(PIPE)) {
		const parts = inner.split(PIPE);
		if (parts.length !== 2) {
			return err("Invalid backlink format");
		}
		filename = parts[0] || "";
		displayName = parts[1] || "";
	} else {
		return err("Invalid backlink format: missing pipe");
	}

	if (!filename || !displayName) {
		return err("Missing filename or displayName");
	}

	// Parse filename to get nodeNameChainToParent
	const separated = separateJoinedSuffixedBasename(filename);
	const nodeNameChainToParent =
		makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);

	// Build IntendedTreeNode based on type
	if (type === CodexLineType.Scroll) {
		return ok({
			node: {
				extension: "md",
				nodeName: displayName,
				nodeNameChainToParent,
				status: status || TreeNodeStatus.NotStarted,
				type: "Scroll",
			},
			type: CodexLineType.Scroll,
		});
	}

	if (type === CodexLineType.File) {
		// Extract extension from filename if possible, otherwise default
		const extensionMatch = filename.match(/\.([^.]+)$/);
		const extension = extensionMatch?.[1] || "";
		return ok({
			node: {
				extension,
				nodeName: displayName,
				nodeNameChainToParent,
				status: TreeNodeStatus.Unknown,
				type: "File",
			},
			type: CodexLineType.File,
		});
	}

	if (type === CodexLineType.ChildSectionCodex) {
		return ok({
			node: {
				children: [],
				nodeName: displayName,
				nodeNameChainToParent,
				status: (status || TreeNodeStatus.NotStarted) as TreeNodeStatus,
				type: "Section",
			},
			type: CodexLineType.ChildSectionCodex,
		});
	}

	if (type === CodexLineType.ParentSectionCodex) {
		return ok({
			node: {
				children: [],
				nodeName: displayName,
				nodeNameChainToParent,
				status: TreeNodeStatus.NotStarted,
				type: "Section",
			},
			type: CodexLineType.ParentSectionCodex,
		});
	}

	return err(`Unknown type: ${type}`);
}

function formatBacklink(basename: string, displayName: string): string {
	return `${OBSIDIAN_LINK_OPEN}${basename}${PIPE}${displayName}${OBSIDIAN_LINK_CLOSE}`;
}

function formatParentBacklink(basename: string, displayName: string): string {
	return formatBacklink(basename, `${BACK_ARROW}${SPACE_F}${displayName}`);
}
