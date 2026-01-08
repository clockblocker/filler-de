import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileNodeDeprecated,
	ScrollNodeDeprecated,
	SectionNodeDeprecated,
} from "../../types/tree-node";
import { TreeNodeTypeDeprecated } from "../../types/tree-node";
import { makePathPartsFromNodeNameChain } from "../codecs/atomic/path-parts-and-node-name-chain";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "./basename-and-chain";

export function buildCanonicalSplitPathFromNode(
	node: SectionNodeDeprecated,
): SplitPathToFolder;
export function buildCanonicalSplitPathFromNode(
	node: FileNodeDeprecated,
): SplitPathToFile;
export function buildCanonicalSplitPathFromNode(
	node: ScrollNodeDeprecated,
): SplitPathToMdFile;
export function buildCanonicalSplitPathFromNode(
	node: SectionNodeDeprecated | FileNodeDeprecated | ScrollNodeDeprecated,
): SplitPathToFolder | SplitPathToFile | SplitPathToMdFile {
	if (node.type === TreeNodeTypeDeprecated.Section) {
		return {
			basename: node.nodeName,
			pathParts: makePathPartsFromNodeNameChain(
				node.nodeNameChainToParent,
			),
			type: SplitPathType.Folder,
		};
	}

	const pathParts = makePathPartsFromNodeNameChain(
		node.nodeNameChainToParent,
	);

	// Codec expects chain with library root and will strip it during encoding
	const basename = makeJoinedSuffixedBasenameFromNodeNameChain([
		...node.nodeNameChainToParent,
		node.nodeName,
	]);

	if (node.type === TreeNodeTypeDeprecated.Scroll) {
		return {
			basename,
			extension: "md",
			pathParts,
			type: SplitPathType.MdFile,
		};
	}

	return {
		basename,
		extension: node.extension,
		pathParts,
		type: SplitPathType.File,
	};
}
