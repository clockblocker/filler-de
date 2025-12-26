import z from "zod";
import { SplitPathType } from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "../../../types/tree-node";
import {
	type SuffixedSplitPath,
	SuffixedSplitPathSchema,
} from "../../types/suffixed/suffixed-split-paths";
import {
	makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename,
} from "../atomic/joined-canonical-basename-and-separated-canonical-basename";
import {
	makeNodeNameChainFromPathParts,
	makePathPartsFromNodeNameChain,
} from "../atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromNodeNameChain,
} from "../atomic/separated-canonical-basename-and-node-name-chain";

/**
 * Zod codec from TreeNode to SuffixedSplitPath.
 * Converts tree representation to canonical split path.
 * Reads settings internally.
 */
const treeNodeToSuffixedSplitPathCodec = z.codec(
	z.custom<TreeNode>(),
	SuffixedSplitPathSchema,
	{
		decode: (node: TreeNode): SuffixedSplitPath => {
			if (node.type === TreeNodeType.Section) {
				// Section: folder basename is nodeName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				const pathParts = makePathPartsFromNodeNameChain(
					node.nodeNameChainToParent,
				);

				// For folders, basename is just the nodeName
				const separated =
					makeSeparatedSuffixedBasenameFromNodeNameChain([
						node.nodeName,
					]);

				const basename =
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
						separated,
					);

				return {
					basename,
					pathParts,
					type: SplitPathType.Folder,
				};
			}

			// Scroll/File: build basename with suffix from full chain
			const fullChain = [...node.nodeNameChainToParent, node.nodeName];
			const separated =
				makeSeparatedSuffixedBasenameFromNodeNameChain(fullChain);
			const basename =
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
					separated,
				);

			const pathParts = makePathPartsFromNodeNameChain(
				node.nodeNameChainToParent,
			);

			if (node.type === TreeNodeType.Scroll) {
				return {
					basename,
					extension: "md",
					pathParts,
					type: SplitPathType.MdFile,
				};
			}

			// FileNode
			return {
				basename,
				extension: node.extension,
				pathParts,
				type: SplitPathType.File,
			};
		},
		encode: (canonical: SuffixedSplitPath): TreeNode => {
			if (canonical.type === SplitPathType.Folder) {
				// For sections, decode basename to get nodeName
				const separated =
					makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
						canonical.basename,
					);
				const chain =
					makeNodeNameChainFromSeparatedSuffixedBasename(separated);
				const nodeName = chain[chain.length - 1] ?? "";

				const nodeNameChainToParent = makeNodeNameChainFromPathParts(
					canonical.pathParts,
				);

				return {
					children: [],
					nodeName,
					nodeNameChainToParent,
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				};
			}

			// For files, decode basename to get full chain
			const separated =
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					canonical.basename,
				);
			const fullChain =
				makeNodeNameChainFromSeparatedSuffixedBasename(separated);
			const nodeName = fullChain[fullChain.length - 1] ?? "";

			const nodeNameChainToParent = makeNodeNameChainFromPathParts(
				canonical.pathParts,
			);

			if (canonical.type === SplitPathType.MdFile) {
				return {
					extension: "md",
					nodeName,
					nodeNameChainToParent,
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				};
			}

			return {
				extension: canonical.extension,
				nodeName,
				nodeNameChainToParent,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		},
	},
);

export const makeSuffixedSplitPathFromTreeNode = (
	node: TreeNode,
): SuffixedSplitPath => {
	return treeNodeToSuffixedSplitPathCodec.decode(node);
};

export const makeTreeNodeFromSuffixedSplitPath = (
	canonical: SuffixedSplitPath,
): TreeNode => {
	return treeNodeToSuffixedSplitPathCodec.encode(canonical);
};
