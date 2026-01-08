import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TreeLeafDeprecated } from "../types/tree-node";
import {
	TreeNodeStatusDeprecated,
	TreeNodeTypeDeprecated,
} from "../types/tree-node";
import { parseBasenameDeprecated } from "./parse-basename";

/** @deprecated */
export function splitPathToLeafDeprecated(
	splitPath: SplitPathToFile | SplitPathToMdFile,
): TreeLeafDeprecated {
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
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};
	}

	// Extract extension from splitPath
	const extension = "extension" in splitPath ? splitPath.extension : "";

	return {
		extension,
		nodeName,
		nodeNameChainToParent,
		status: TreeNodeStatusDeprecated.Unknown,
		type: TreeNodeTypeDeprecated.File,
	};
}
