import z from "zod";
import { SplitPathType } from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "../../../types/tree-node";
import {
	type CanonicalSplitPath,
	CanonicalSplitPathSchema,
} from "../../types/canonical/split-path/canonical-split-paths";
import {
	makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename,
} from "../atomic/joined-canonical-basename-and-separated-canonical-basename";
import {
	makeNodeNameChainFromPathParts,
	makePathPartsFromNodeNameChain,
} from "../atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromNodeNameChain,
} from "../atomic/separated-canonical-basename-and-node-name-chain";

/**
 * Zod codec from TreeNode to CanonicalSplitPath.
 * Converts tree representation to canonical split path.
 * Reads settings internally.
 */
const treeNodeToCanonicalSplitPathCodec = z.codec(
	z.custom<TreeNode>(),
	CanonicalSplitPathSchema,
	{
		decode: (node: TreeNode): CanonicalSplitPath => {
			if (node.type === TreeNodeType.Section) {
				// Section: folder basename is nodeName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				const pathParts = makePathPartsFromNodeNameChain(
					node.nodeNameChainToParent,
				);

				// For folders, basename is just the nodeName
				const separated =
					makeSeparatedCanonicalBasenameFromNodeNameChain([
						node.nodeName,
					]);

				const basename =
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(
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
				makeSeparatedCanonicalBasenameFromNodeNameChain(fullChain);
			const basename =
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(
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
		encode: (canonical: CanonicalSplitPath): TreeNode => {
			if (canonical.type === SplitPathType.Folder) {
				// For sections, decode basename to get nodeName
				const separated =
					makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
						canonical.basename,
					);
				const chain =
					makeNodeNameChainFromSeparatedCanonicalBasename(separated);
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
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					canonical.basename,
				);
			const fullChain =
				makeNodeNameChainFromSeparatedCanonicalBasename(separated);
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

export const makeCanonicalSplitPathFromTreeNode = (
	node: TreeNode,
): CanonicalSplitPath => {
	return treeNodeToCanonicalSplitPathCodec.decode(node);
};

export const makeTreeNodeFromCanonicalSplitPath = (
	canonical: CanonicalSplitPath,
): TreeNode => {
	return treeNodeToCanonicalSplitPathCodec.encode(canonical);
};
