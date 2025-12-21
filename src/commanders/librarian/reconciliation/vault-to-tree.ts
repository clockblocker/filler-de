/**
 * Translates VaultActions to TreeActions.
 *
 * VaultAction → TreeAction mapping:
 * - Create* → CreateNode
 * - Trash* → DeleteNode
 * - Rename* (same folder) → ChangeNodeName
 * - Rename* (diff folder) → MoveNode
 */

import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { TreeActionType } from "../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { TreeAction } from "../types/tree-action";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasename } from "../utils/parse-basename";

/**
 * Translate a VaultAction to TreeAction(s).
 * Returns null if action doesn't affect tree (e.g., ProcessMdFile).
 */
export function translateVaultAction(action: VaultAction): TreeAction | null {
	const { type, payload } = action;

	switch (type) {
		// Create actions
		case "CreateFolder":
			return createSectionAction(payload.splitPath);

		case "CreateFile":
			return createFileAction(payload.splitPath);

		case "CreateMdFile":
			return createScrollAction(payload.splitPath);

		// Trash actions
		case "TrashFolder":
		case "TrashFile":
		case "TrashMdFile":
			return deleteNodeAction(payload.splitPath);

		// Rename actions - detect move vs rename
		case "RenameFolder":
		case "RenameFile":
		case "RenameMdFile":
			return translateRename(payload.from, payload.to);

		// Content operations don't affect tree structure
		case "ProcessMdFile":
		case "ReplaceContentMdFile":
			return null;
	}
}

/**
 * Check if two paths have the same parent folder.
 */
function sameParent(from: SplitPath, to: SplitPath): boolean {
	if (from.pathParts.length !== to.pathParts.length) {
		return false;
	}
	return from.pathParts.every((part, i) => part === to.pathParts[i]);
}

/**
 * Extract coreNameChain from SplitPath (relative to library root).
 * Parses basename to extract coreName (not full basename).
 * Reads libraryRoot and suffixDelimiter from global settings.
 */
function toCoreNameChain(splitPath: SplitPath): CoreNameChainFromRoot {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	const parts = splitPath.pathParts;
	// Skip library root
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	const pathParts = parts.slice(startIndex);

	// Parse basename to get coreName (not full basename with suffix)
	const { coreName } = parseBasename(splitPath.basename);

	return [...pathParts, coreName];
}

/**
 * Extract parent chain from SplitPath (relative to library root).
 * Reads libraryRoot from global settings.
 */
function toParentChain(splitPath: SplitPath): CoreNameChainFromRoot {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	const parts = splitPath.pathParts;
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	return parts.slice(startIndex);
}

function createSectionAction(splitPath: SplitPath): TreeAction {
	return {
		payload: {
			coreName: splitPath.basename,
			coreNameChainToParent: toParentChain(splitPath),
			nodeType: TreeNodeType.Section,
			status: TreeNodeStatus.NotStarted,
		},
		type: TreeActionType.CreateNode,
	};
}

function createFileAction(splitPath: SplitPath): TreeAction | null {
	const { coreName } = parseBasename(splitPath.basename);
	const extension = "extension" in splitPath ? splitPath.extension : "";

	return {
		payload: {
			coreName,
			coreNameChainToParent: toParentChain(splitPath),
			extension,
			nodeType: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
		},
		type: TreeActionType.CreateNode,
	};
}

function createScrollAction(splitPath: SplitPath): TreeAction | null {
	const { coreName } = parseBasename(splitPath.basename);

	return {
		payload: {
			coreName,
			coreNameChainToParent: toParentChain(splitPath),
			extension: "md",
			nodeType: TreeNodeType.Scroll,
			status: TreeNodeStatus.NotStarted,
		},
		type: TreeActionType.CreateNode,
	};
}

function deleteNodeAction(splitPath: SplitPath): TreeAction {
	return {
		payload: {
			coreNameChain: toCoreNameChain(splitPath),
		},
		type: TreeActionType.DeleteNode,
	};
}

function translateRename(from: SplitPath, to: SplitPath): TreeAction {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	
	// Check if from path is inside library
	const fromInsideLibrary = from.pathParts[0] === libraryRoot || 
		from.pathParts.some((part, i) => part === libraryRoot && i > 0);
	const toInsideLibrary = to.pathParts[0] === libraryRoot || 
		to.pathParts.some((part, i) => part === libraryRoot && i > 0);
	
	// If from is outside library but to is inside, treat as CreateNode
	if (!fromInsideLibrary && toInsideLibrary) {
		if (to.type === "MdFile") {
			return createScrollAction(to);
		} else if (to.type === "File") {
			return createFileAction(to);
		}
		// Folder - should be handled by CreateFolder action
		return createSectionAction(to);
	}
	
	// If from is inside library but to is outside, treat as DeleteNode
	if (fromInsideLibrary && !toInsideLibrary) {
		return deleteNodeAction(from);
	}
	
	// Both inside library - normal rename/move
	const fromChain = toCoreNameChain(from);

	if (sameParent(from, to)) {
		// Same folder → ChangeNodeName
		// Parse to.basename to get coreName (not full basename)
		const { coreName: newCoreName } = parseBasename(to.basename);
		const action = {
			payload: {
				coreNameChain: fromChain,
				newCoreName,
			},
			type: TreeActionType.ChangeNodeName,
		};
		return action;
	}

	// Different folder → MoveNode
	const newParentChain = toParentChain(to);
	const action = {
		payload: {
			coreNameChain: fromChain,
			newCoreNameChainToParent: newParentChain,
		},
		type: TreeActionType.MoveNode,
	};
	return action;
}
