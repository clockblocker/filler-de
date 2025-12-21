/**
 * Translates VaultActions to TreeActions.
 *
 * VaultAction → TreeAction mapping:
 * - Create* → CreateNode
 * - Trash* → DeleteNode
 * - Rename* (same folder) → ChangeNodeName
 * - Rename* (diff folder) → MoveNode
 */

import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { TreeActionType } from "../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { TreeAction } from "../types/tree-action";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { parseBasename } from "../utils/parse-basename";

/**
 * Context needed for translation.
 * Note: tRef removed - TFile references become stale when files are renamed/moved.
 */
export type TranslationContext = {
	/** Library root folder name (e.g., "Library") */
	libraryRoot: string;
	/** Initial status for new scroll nodes */
	defaultScrollStatus?:
		| typeof TreeNodeStatus.Done
		| typeof TreeNodeStatus.NotStarted;
	/** Suffix delimiter for parsing basenames (default: "-") */
	suffixDelimiter?: string;
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
 * Parses basename to extract coreName (not full basename).
 */
function toCoreNameChain(
	splitPath: SplitPath,
	libraryRoot: string,
	suffixDelimiter = "-",
): CoreNameChainFromRoot {
	const parts = splitPath.pathParts;
	// Skip library root
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	const pathParts = parts.slice(startIndex);
	
	// Parse basename to get coreName (not full basename with suffix)
	const { coreName } = parseBasename(splitPath.basename, suffixDelimiter);
	
	return [...pathParts, coreName];
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
	const suffixDelimiter = context.suffixDelimiter ?? "-";
	const { coreName } = parseBasename(splitPath.basename, suffixDelimiter);
	const extension = "extension" in splitPath ? splitPath.extension : "";

	return {
		payload: {
			coreName,
			coreNameChainToParent: toParentChain(
				splitPath,
				context.libraryRoot,
			),
			nodeType: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
			extension,
		},
		type: TreeActionType.CreateNode,
	};
}

function createScrollAction(
	splitPath: SplitPath,
	context: TranslationContext,
): TreeAction | null {
	const suffixDelimiter = context.suffixDelimiter ?? "-";
	const { coreName } = parseBasename(splitPath.basename, suffixDelimiter);

	return {
		payload: {
			coreName,
			coreNameChainToParent: toParentChain(
				splitPath,
				context.libraryRoot,
			),
			nodeType: TreeNodeType.Scroll,
			status: context.defaultScrollStatus ?? TreeNodeStatus.NotStarted,
			extension: "md",
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
	const suffixDelimiter = context.suffixDelimiter ?? "-";
	
	const fromPath = `${from.pathParts.join("/")}/${from.basename}`;
	const toPath = `${to.pathParts.join("/")}/${to.basename}`;
	const sameParentResult = sameParent(from, to);
	
	// Try to find node at fromChain first
	const fromChain = toCoreNameChain(from, context.libraryRoot, suffixDelimiter);
	
	console.log(
		`[TreeStalenessTest] translateRename: fromPath=${fromPath} toPath=${toPath} fromChain=${fromChain.join("/")} sameParent=${sameParentResult}`,
	);

	if (sameParent(from, to)) {
		// Same folder → ChangeNodeName
		// Parse to.basename to get coreName (not full basename)
		const { coreName: newCoreName } = parseBasename(
			to.basename,
			suffixDelimiter,
		);
		const action = {
			payload: {
				coreNameChain: fromChain,
				newCoreName,
			},
			type: TreeActionType.ChangeNodeName,
		};
		console.log(
			`[TreeStalenessTest] translateRename → ChangeNodeName: chain=${fromChain.join("/")} newCoreName=${newCoreName}`,
		);
		return action;
	}

	// Different folder → MoveNode
	const newParentChain = toParentChain(to, context.libraryRoot);
	const action = {
		payload: {
			coreNameChain: fromChain,
			newCoreNameChainToParent: newParentChain,
		},
		type: TreeActionType.MoveNode,
	};
	console.log(
		`[TreeStalenessTest] translateRename → MoveNode: chain=${fromChain.join("/")} newParent=${newParentChain.join("/")}`,
	);
	return action;
}

function splitPathToString(splitPath: SplitPath): string {
	const parts = [...splitPath.pathParts, splitPath.basename];
	if ("extension" in splitPath && splitPath.extension) {
		return parts.join("/") + "." + splitPath.extension;
	}
	return parts.join("/");
}
