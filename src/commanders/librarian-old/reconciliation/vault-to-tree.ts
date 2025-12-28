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
import { TreeActionType } from "../../librarin-shared/types/literals";
import type { NodeNameChain } from "../../librarin-shared/types/node-name";
import type { TreeAction } from "../../librarin-shared/types/tree-action";
import { makeNodeNameChainFromPathParts } from "../naming/codecs/atomic/path-parts-and-node-name-chain";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasenameDeprecated } from "../utils/parse-basename";

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
			return null;

		case "UpsertMdFile":
			// UpsertMdFile can create new files or update content
			// If content is provided (not null/undefined), it's a content update → return null
			// If content is null/undefined, it's ensuring file exists (might create) → return createScrollAction
			if (payload.content !== null && payload.content !== undefined) {
				// Content update - doesn't affect tree structure
				return null;
			}
			// Ensure file exists (might create new file) - affects tree structure
			return createScrollAction(payload.splitPath);
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
 * Extract nodeNameChain from SplitPath (with library root).
 * Parses basename to extract nodeName (not full basename).
 * Uses codec to convert pathParts to nodeNameChain (keeps library root).
 */
function toNodeNameChain(splitPath: SplitPath): NodeNameChain {
	// Convert pathParts to chain (includes library root)
	const chainFromPath = makeNodeNameChainFromPathParts(splitPath.pathParts);

	// Parse basename to get nodeName (not full basename with suffix)
	const { nodeName } = parseBasenameDeprecated(splitPath.basename);

	return [...chainFromPath, nodeName];
}

/**
 * Extract parent chain from SplitPath (with library root).
 * Uses codec to convert pathParts to nodeNameChain (keeps library root).
 */
function toParentChain(splitPath: SplitPath): NodeNameChain {
	// Convert pathParts to chain (includes library root)
	return makeNodeNameChainFromPathParts(splitPath.pathParts);
}

function createSectionAction(splitPath: SplitPath): TreeAction {
	return {
		payload: {
			nodeName: splitPath.basename,
			nodeNameChainToParent: toParentChain(splitPath),
			nodeType: TreeNodeType.Section,
			status: TreeNodeStatus.NotStarted,
		},
		type: TreeActionType.CreateNode,
	};
}

function createFileAction(splitPath: SplitPath): TreeAction | null {
	const { nodeName } = parseBasenameDeprecated(splitPath.basename);
	const extension = "extension" in splitPath ? splitPath.extension : "";

	return {
		payload: {
			extension,
			nodeName,
			nodeNameChainToParent: toParentChain(splitPath),
			nodeType: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
		},
		type: TreeActionType.CreateNode,
	};
}

function createScrollAction(splitPath: SplitPath): TreeAction | null {
	const { nodeName } = parseBasenameDeprecated(splitPath.basename);

	return {
		payload: {
			extension: "md",
			nodeName,
			nodeNameChainToParent: toParentChain(splitPath),
			nodeType: TreeNodeType.Scroll,
			status: TreeNodeStatus.NotStarted,
		},
		type: TreeActionType.CreateNode,
	};
}

function deleteNodeAction(splitPath: SplitPath): TreeAction {
	return {
		payload: {
			nodeNameChain: toNodeNameChain(splitPath),
		},
		type: TreeActionType.DeleteNode,
	};
}

function translateRename(from: SplitPath, to: SplitPath): TreeAction {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	// Check if from path is inside library
	const fromInsideLibrary =
		from.pathParts[0] === libraryRoot ||
		from.pathParts.some((part, i) => part === libraryRoot && i > 0);
	const toInsideLibrary =
		to.pathParts[0] === libraryRoot ||
		to.pathParts.some((part, i) => part === libraryRoot && i > 0);

	// If from is outside library but to is inside, treat as CreateNode
	if (!fromInsideLibrary && toInsideLibrary) {
		if (to.type === "MdFile") {
			return createScrollAction(to);
		}
		if (to.type === "File") {
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
	const fromChain = toNodeNameChain(from);

	if (sameParent(from, to)) {
		// Same folder → ChangeNodeName
		// Parse to.basename to get nodeName (not full basename)
		const { nodeName: newNodeName } = parseBasenameDeprecated(to.basename);
		const action = {
			payload: {
				newNodeName,
				nodeNameChain: fromChain,
			},
			type: TreeActionType.ChangeNodeName,
		};
		return action;
	}

	// Different folder → MoveNode
	const newParentChain = toParentChain(to);
	const action = {
		payload: {
			newNodeNameChainToParent: newParentChain,
			nodeNameChain: fromChain,
		},
		type: TreeActionType.MoveNode,
	};
	return action;
}
