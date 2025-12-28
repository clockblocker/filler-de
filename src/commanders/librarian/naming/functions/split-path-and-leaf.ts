import { getParsedUserSettings } from "../../../../global-state/global-state";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../obsidian-vault-action-manager/types/split-path";
import type { FileNode, ScrollNode, SectionNode } from "../../types/tree-node";
import { TreeNodeType } from "../../types/tree-node";
import { makePathPartsFromNodeNameChain } from "../codecs/atomic/path-parts-and-node-name-chain";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "./basename-and-chain";

export function buildCanonicalSplitPathFromNode(
	node: SectionNode,
): SplitPathToFolder;
export function buildCanonicalSplitPathFromNode(
	node: FileNode,
): SplitPathToFile;
export function buildCanonicalSplitPathFromNode(
	node: ScrollNode,
): SplitPathToMdFile;
export function buildCanonicalSplitPathFromNode(
	node: SectionNode | FileNode | ScrollNode,
): SplitPathToFolder | SplitPathToFile | SplitPathToMdFile {
	if (node.type === TreeNodeType.Section) {
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

	// Strip library root from chain before building basename (user-visible format)
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const chainWithoutLibraryRoot =
		node.nodeNameChainToParent.length > 0 &&
		node.nodeNameChainToParent[0] === libraryRoot
			? node.nodeNameChainToParent.slice(1)
			: node.nodeNameChainToParent;

	const basename = makeJoinedSuffixedBasenameFromNodeNameChain([
		...chainWithoutLibraryRoot,
		node.nodeName,
	]);

	if (node.type === TreeNodeType.Scroll) {
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
