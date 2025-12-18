/**
 * Translates VaultActions to TreeActions.
 *
 * VaultAction → TreeAction mapping:
 * - Create* → CreateNode
 * - Trash* → DeleteNode
 * - Rename* (same folder) → ChangeNodeName
 * - Rename* (diff folder) → MoveNode
 */

import type { TFile } from "obsidian";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import type {
	VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { TreeActionType } from "../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { TreeAction } from "../types/tree-action";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";

/**
 * Context needed for translation.
 * TFile refs are needed for CreateNode actions.
 */
export type TranslationContext = {
	/** Library root folder name (e.g., "Library") */
	libraryRoot: string;
	/** Get TFile ref for a path (needed for CreateNode) */
	getTRef?: (path: string) => TFile | null;
	/** Initial status for new scroll nodes */
	defaultScrollStatus?:
		| typeof TreeNodeStatus.Done
		| typeof TreeNodeStatus.NotStarted;
};

/**
 * Translate a VaultAction to TreeAction(s).
 * Returns null if action doesn't affect tree (e.g., ProcessMdFile).
 */
export function translateVaultAction(
	action: VaultAction,
	context: TranslationContext,
): TreeAction | null {
	const { type, payload } = action;

	switch (type) {
		// Create actions
		case "CreateFolder":
			return createSectionAction(payload.splitPath, context);

		case "CreateFile":
			return createFileAction(payload.splitPath, context);

		case "CreateMdFile":
			return createScrollAction(payload.splitPath, context);

		// Trash actions
		case "TrashFolder":
		case "TrashFile":
		case "TrashMdFile":
			return deleteNodeAction(payload.splitPath, context);

		// Rename actions - detect move vs rename
		case "RenameFolder":
		case "RenameFile":
		case "RenameMdFile":
			return translateRename(payload.from, payload.to, context);

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
 */
function toCoreNameChain(
	splitPath: SplitPath,
	libraryRoot: string,
): CoreNameChainFromRoot {
	const parts = splitPath.pathParts;
	// Skip library root
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	return [...parts.slice(startIndex), splitPath.basename];
}

/**
 * Extract parent chain from SplitPath (relative to library root).
 */
function toParentChain(
	splitPath: SplitPath,
	libraryRoot: string,
): CoreNameChainFromRoot {
	const parts = splitPath.pathParts;
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	return parts.slice(startIndex);
}

function createSectionAction(
	splitPath: SplitPath,
	context: TranslationContext,
): TreeAction {
	return {
		payload: {
			coreName: splitPath.basename,
			coreNameChainToParent: toParentChain(
				splitPath,
				context.libraryRoot,
			),
			nodeType: TreeNodeType.Section,
			status: TreeNodeStatus.NotStarted,
		},
		type: TreeActionType.CreateNode,
	};
}

function createFileAction(
	splitPath: SplitPath,
	context: TranslationContext,
): TreeAction | null {
	const tRef = context.getTRef?.(splitPathToString(splitPath));
	if (!tRef) {
		// Can't create FileNode without TRef
		return null;
	}

	return {
		payload: {
			coreName: splitPath.basename,
			coreNameChainToParent: toParentChain(
				splitPath,
				context.libraryRoot,
			),
			nodeType: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
			tRef,
		},
		type: TreeActionType.CreateNode,
	};
}

function createScrollAction(
	splitPath: SplitPath,
	context: TranslationContext,
): TreeAction | null {
	const tRef = context.getTRef?.(splitPathToString(splitPath));
	if (!tRef) {
		// Can't create ScrollNode without TRef
		return null;
	}

	return {
		payload: {
			coreName: splitPath.basename,
			coreNameChainToParent: toParentChain(
				splitPath,
				context.libraryRoot,
			),
			nodeType: TreeNodeType.Scroll,
			status: context.defaultScrollStatus ?? TreeNodeStatus.NotStarted,
			tRef,
		},
		type: TreeActionType.CreateNode,
	};
}

function deleteNodeAction(
	splitPath: SplitPath,
	context: TranslationContext,
): TreeAction {
	return {
		payload: {
			coreNameChain: toCoreNameChain(splitPath, context.libraryRoot),
		},
		type: TreeActionType.DeleteNode,
	};
}

function translateRename(
	from: SplitPath,
	to: SplitPath,
	context: TranslationContext,
): TreeAction {
	const fromChain = toCoreNameChain(from, context.libraryRoot);

	if (sameParent(from, to)) {
		// Same folder → ChangeNodeName
		return {
			payload: {
				coreNameChain: fromChain,
				newCoreName: to.basename,
			},
			type: TreeActionType.ChangeNodeName,
		};
	}

	// Different folder → MoveNode
	return {
		payload: {
			coreNameChain: fromChain,
			newCoreNameChainToParent: toParentChain(to, context.libraryRoot),
		},
		type: TreeActionType.MoveNode,
	};
}

function splitPathToString(splitPath: SplitPath): string {
	const parts = [...splitPath.pathParts, splitPath.basename];
	if ("extension" in splitPath && splitPath.extension) {
		return parts.join("/") + "." + splitPath.extension;
	}
	return parts.join("/");
}
