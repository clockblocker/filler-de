import z from "zod";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import {
	type SplitPath,
	SplitPathSchema,
	SplitPathType,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import {
	type TreeNode,
	TreeNodeStatus,
	TreeNodeType,
} from "../../types/tree-node";
import { canonicalBasenameToChainCodec } from "./suffixed-basename-to-chain-codec";

/**
 * Zod codec from TreeNode to SplitPath.
 * Converts tree representation to filesystem representation.
 * Reads settings internally.
 */
export const treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse = z.codec(
	z.custom<TreeNode>(),
	SplitPathSchema,
	{
		decode: (node: TreeNode): SplitPath => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (node.type === TreeNodeType.Section) {
				// Section: folder basename is nodeName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				// nodeNameChainToParent already includes library root
				const pathParts =
					node.nodeNameChainToParent.length === 0
						? [] // Root library
						: node.nodeNameChainToParent; // Already includes library root

				return {
					basename: node.nodeName,
					pathParts,
					type: SplitPathType.Folder,
				};
			}

			// Scroll/File: build basename with suffix
			// Chain should be from root to leaf: [...parentChain, nodeName]
			// nodeNameChainToParent already includes library root, strip it for basename encoding
			const parentChainWithoutLibraryRoot =
				node.nodeNameChainToParent.length > 0 &&
				node.nodeNameChainToParent[0] === libraryRoot
					? node.nodeNameChainToParent.slice(1)
					: node.nodeNameChainToParent;

			const basename = canonicalBasenameToChainCodec.encode([
				...parentChainWithoutLibraryRoot,
				node.nodeName,
			]);

			// pathParts already includes library root
			const pathParts = node.nodeNameChainToParent;

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
		encode: ({ basename, pathParts, ...rest }: SplitPath): TreeNode => {
			if (rest.type === SplitPathType.Folder) {
				// For sections, basename is the nodeName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				// pathParts already includes library root
				const nodeName = basename;
				const nodeNameChainToParent = pathParts; // Already includes library root

				return {
					children: [],
					nodeName,
					nodeNameChainToParent,
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				};
			}

			// For files, decode basename to get nodeName and parent chain
			// Basename doesn't include library root, so decode it
			const fullChainWithoutLibraryRoot =
				canonicalBasenameToChainCodec.decode(basename);
			const nodeName =
				fullChainWithoutLibraryRoot[
					fullChainWithoutLibraryRoot.length - 1
				] ?? "";

			// pathParts already includes library root, use it directly
			const nodeNameChainToParent = pathParts;

			if (rest.type === SplitPathType.MdFile) {
				return {
					extension: "md",
					nodeName,
					nodeNameChainToParent,
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				};
			}

			return {
				extension: rest.extension,
				nodeName,
				nodeNameChainToParent,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		},
	},
);
