import type {
	SplitPathToFileWithTRef,
	SplitPathToMdFileWithTRef,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import type { TreeLeafDto } from "../types/tree-leaf-dto";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasename } from "./parse-basename";

/**
 * Convert SplitPathWithTRef (file) to TreeLeafDto.
 * Parses basename to extract coreName and determines node type.
 *
 * Note: coreNameChainToParent will be recalculated by LibraryTree from pathParts,
 * but we set it here to satisfy the type. The tree will override it.
 */
export function splitPathToLeafDto(
	splitPathWithTRef: SplitPathToFileWithTRef | SplitPathToMdFileWithTRef,
	suffixDelimiter = "-",
): TreeLeafDto {
	const { basename, pathParts, type } = splitPathWithTRef;
	const { coreName } = parseBasename(basename, suffixDelimiter);

	// coreNameChainToParent will be recalculated by LibraryTree from pathParts
	// This is just a placeholder to satisfy the type
	const coreNameChainToParent: string[] = [];

	if (type === "MdFile") {
		return {
			coreName,
			coreNameChainToParent,
			pathParts,
			status: TreeNodeStatus.NotStarted,
			tRef: splitPathWithTRef.tRef,
			type: TreeNodeType.Scroll,
		};
	}

	return {
		coreName,
		coreNameChainToParent,
		pathParts,
		status: TreeNodeStatus.Unknown,
		tRef: splitPathWithTRef.tRef,
		type: TreeNodeType.File,
	};
}
