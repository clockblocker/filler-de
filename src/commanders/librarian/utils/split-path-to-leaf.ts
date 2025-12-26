import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { TreeLeaf } from "../types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasenameDeprecated } from "./parse-basename";

/** @deprecated */
export function splitPathToLeafDeprecated(
	splitPath: SplitPathToFile | SplitPathToMdFile,
): TreeLeaf {
	const settings = getParsedUserSettings();
	const rootFolderName = settings.splitPathToLibraryRoot.basename;
	const { basename, pathParts, type } = splitPath;
	const { nodeName } = parseBasenameDeprecated(basename);

	// Convert pathParts to nodeNameChainToParent by stripping root folder
	const nodeNameChainToParent =
		pathParts[0] === rootFolderName ? pathParts.slice(1) : pathParts;

	if (type === "MdFile") {
		return {
			extension: "md",
			nodeName,
			nodeNameChainToParent,
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};
	}

	// Extract extension from splitPath
	const extension = "extension" in splitPath ? splitPath.extension : "";
	return {
		extension,
		nodeName,
		nodeNameChainToParent,
		status: TreeNodeStatus.Unknown,
		type: TreeNodeType.File,
	};
}

/** @deprecated */
export async function withStatusFromMetaDeprecated(
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
