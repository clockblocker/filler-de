import type { TFile } from "obsidian";
import type {
	SplitPathToFileWithTRef,
	SplitPathToMdFileWithTRef,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { TreeLeaf } from "../types/tree-leaf";
import type { ScrollNode } from "../types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasename } from "./parse-basename";

/**
 * Codec: SplitPath + tRef → TreeLeaf
 * Converts filesystem representation to tree representation.
 *
 * @param rootFolderName - The library root folder name to strip from pathParts
 * @param suffixDelimiter - Delimiter for parsing basename suffix
 */
export function splitPathToLeaf(
	splitPathWithTRef: SplitPathToFileWithTRef | SplitPathToMdFileWithTRef,
	rootFolderName = "Library",
	suffixDelimiter = "-",
): TreeLeaf {
	const { basename, pathParts, type } = splitPathWithTRef;
	const { coreName } = parseBasename(basename, suffixDelimiter);

	// Convert pathParts to coreNameChainToParent by stripping root folder
	const coreNameChainToParent =
		pathParts[0] === rootFolderName ? pathParts.slice(1) : pathParts;

	if (type === "MdFile") {
		return {
			coreName,
			coreNameChainToParent,
			status: TreeNodeStatus.NotStarted,
			tRef: splitPathWithTRef.tRef,
			type: TreeNodeType.Scroll,
		};
	}

	return {
		coreName,
		coreNameChainToParent,
		status: TreeNodeStatus.Unknown,
		tRef: splitPathWithTRef.tRef,
		type: TreeNodeType.File,
	};
}

/**
 * Reads file content, extracts MetaInfo, and injects status into ScrollNode.
 * FileNodes are returned unchanged.
 */
export async function withStatusFromMeta(
	leaf: TreeLeaf,
	readContent: (tRef: TFile) => Promise<string>,
	extractMetaInfo: (content: string) => MetaInfo | null,
): Promise<TreeLeaf> {
	if (leaf.type !== TreeNodeType.Scroll) {
		return leaf;
	}

	const content = await readContent(leaf.tRef);
	const meta = extractMetaInfo(content);

	if (!meta || !("status" in meta)) {
		return leaf;
	}

	const status =
		meta.status === "Done"
			? TreeNodeStatus.Done
			: TreeNodeStatus.NotStarted;

	return { ...leaf, status };
}
