import type {
	SplitPathToFileWithTRef,
	SplitPathToMdFileWithTRef,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { TreeLeaf } from "../types/tree-leaf";
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
