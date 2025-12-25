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
import { suffixedBasenameToChainCodec } from "./suffixed-basename-to-chain-codec";

/**
 * Zod codec from TreeNode to SplitPath.
 * Converts tree representation to filesystem representation.
 * Reads settings internally.
 */
export const treeNodeToSuffixedSplitPathCodec = z.codec(
	z.custom<TreeNode>(),
	SplitPathSchema,
	{
		decode: (node: TreeNode): SplitPath => {
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (node.type === TreeNodeType.Section) {
				// Section: folder basename is coreName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				// For root section (empty parent chain), pathParts is empty
				const pathParts =
					node.coreNameChainToParent.length === 0
						? []
						: [libraryRoot, ...node.coreNameChainToParent];

				return {
					basename: node.coreName,
					pathParts,
					type: SplitPathType.Folder,
				};
			}

			// Scroll/File: build basename with suffix
			// Chain should be from root to leaf: [...parentChain, coreName]
			const basename = suffixedBasenameToChainCodec.encode([
				...node.coreNameChainToParent,
				node.coreName,
			]);

			const pathParts = [libraryRoot, ...node.coreNameChainToParent];

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
			const settings = getParsedUserSettings();
			const libraryRoot = settings.splitPathToLibraryRoot.basename;

			if (rest.type === SplitPathType.Folder) {
				// For sections, basename is the coreName (no suffix)
				// pathParts is parent path, doesn't include the section itself
				const coreName = basename;
				const startIndex = pathParts[0] === libraryRoot ? 1 : 0;
				const coreNameChainToParent = pathParts.slice(startIndex);

				return {
					children: [],
					coreName,
					coreNameChainToParent,
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				};
			}

			// For files, decode basename to get coreName and parent chain
			const fullChain = suffixedBasenameToChainCodec.decode(basename);
			const coreName = fullChain[fullChain.length - 1] ?? "";
			const startIndex = pathParts[0] === libraryRoot ? 1 : 0;
			const pathPartsAfterRoot = pathParts.slice(startIndex);

			// For files, pathParts doesn't include the file name
			const coreNameChainToParent = pathPartsAfterRoot;

			if (rest.type === SplitPathType.MdFile) {
				return {
					coreName,
					coreNameChainToParent,
					extension: "md",
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				};
			}

			return {
				coreName,
				coreNameChainToParent,
				extension: rest.extension,
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
		},
	},
);
