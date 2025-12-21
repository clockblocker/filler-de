import type {
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { TreeLeaf } from "../types/tree-leaf";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasename } from "./parse-basename";

/**
 * Codec: SplitPath → TreeLeaf
 * Converts filesystem representation to tree representation.
 * Note: tRef is NOT stored - TFile references become stale when files are renamed/moved.
 *
 * @param splitPath - SplitPath (with or without tRef, we don't use it)
 * @param rootFolderName - The library root folder name to strip from pathParts
 * @param suffixDelimiter - Delimiter for parsing basename suffix
 */
export function splitPathToLeaf(
	splitPath:
		| SplitPathToFile
		| SplitPathToMdFile
		| SplitPathToFileWithTRef
		| SplitPathToMdFileWithTRef,
	rootFolderName = "Library",
	suffixDelimiter = "-",
): TreeLeaf {
	const { basename, pathParts, type } = splitPath;
	const { coreName } = parseBasename(basename, suffixDelimiter);

	// Convert pathParts to coreNameChainToParent by stripping root folder
	const coreNameChainToParent =
		pathParts[0] === rootFolderName ? pathParts.slice(1) : pathParts;

	if (type === "MdFile") {
		return {
			coreName,
			coreNameChainToParent,
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};
	}

	// Extract extension from splitPath
	const extension = "extension" in splitPath ? splitPath.extension : "";
	return {
		coreName,
		coreNameChainToParent,
		extension,
		status: TreeNodeStatus.Unknown,
		type: TreeNodeType.File,
	};
}

/**
 * Reads file content, extracts MetaInfo, and injects status into ScrollNode.
 * FileNodes are returned unchanged.
 * Note: Uses original file path (with suffix) - not reconstructed from tree structure.
 */
export async function withStatusFromMeta(
	leaf: TreeLeaf,
	originalPath: string,
	readContent: (path: string) => Promise<string>,
	extractMetaInfo: (content: string) => MetaInfo | null,
): Promise<TreeLeaf> {
	if (leaf.type !== TreeNodeType.Scroll) {
		return leaf;
	}

	// Use original path (includes suffix in basename) - don't reconstruct from tree
	const content = await readContent(originalPath);
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
