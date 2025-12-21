import type { VaultEvent } from "../../../obsidian-vault-action-manager";
import { systemPathFromSplitPath } from "../../../obsidian-vault-action-manager/helpers/pathfinder";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { dedupeChains, expandToAncestors } from "../codex/impacted-chains";
import { detectRenameMode } from "../healing";
import type { LibraryTree } from "../library-tree";
import { TreeActionType } from "../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import { isCodexBasename } from "../utils/codex-utils";
import { resolveActions } from "./action-resolver";
import {
	type CodexRegeneratorContext,
	regenerateCodexes,
} from "./codex-regenerator";
import { computeCreateAction } from "./create-handler";
import {
	extractBasenameWithoutExt,
	parseDeletePathToChain,
} from "./path-parsers";
import { applyActionsToTree, type TreeApplierContext } from "./tree-applier";
import { readTreeFromVault, type TreeReaderContext } from "./tree-reader";

export type EventHandlerContext = {
	dispatch: (actions: VaultAction[]) => Promise<unknown>;
	libraryRoot: string;
	readTree: () => Promise<LibraryTree>;
	setTree: (tree: LibraryTree) => void;
	splitPath: (path: string) => ReturnType<TreeReaderContext["splitPath"]>;
	suffixDelimiter: string;
	tree: LibraryTree | null;
} & Pick<CodexRegeneratorContext, "getNode"> &
	Pick<TreeApplierContext, "suffixDelimiter"> &
	Pick<TreeReaderContext, "listAll">;

/**
 * Extract handler info from VaultEvent.
 * Pure function that converts events to handler parameters.
 */
export function parseEventToHandler(
	event: VaultEvent,
	libraryRoot: string,
): {
	type: "rename" | "create" | "delete";
	oldPath?: string;
	newPath?: string;
	path: string;
	isFolder: boolean;
} | null {
	if (event.type === "FileRenamed" || event.type === "FolderRenamed") {
		const oldPath = systemPathFromSplitPath(event.from);
		const newPath = systemPathFromSplitPath(event.to);
		// Only handle events within library
		if (
			!oldPath.startsWith(`${libraryRoot}/`) &&
			!newPath.startsWith(`${libraryRoot}/`)
		) {
			return null;
		}
		return {
			isFolder: event.type === "FolderRenamed",
			newPath,
			oldPath,
			path: newPath,
			type: "rename",
		};
	}

	if (event.type === "FileCreated" || event.type === "FolderCreated") {
		const path = systemPathFromSplitPath(event.splitPath);
		// Only handle events within library
		if (!path.startsWith(`${libraryRoot}/`)) {
			return null;
		}
		return {
			isFolder: event.type === "FolderCreated",
			path,
			type: "create",
		};
	}

	if (event.type === "FileTrashed" || event.type === "FolderTrashed") {
		const path = systemPathFromSplitPath(event.splitPath);
		// Only handle events within library
		if (!path.startsWith(`${libraryRoot}/`)) {
			return null;
		}
		return {
			isFolder: event.type === "FolderTrashed",
			path,
			type: "delete",
		};
	}

	return null;
}

/**
 * Check if path should be ignored (outside library or codex file).
 */
export function shouldIgnorePath(
	path: string,
	basenameWithoutExt: string,
	libraryRoot: string,
	isCodexBasename: (basename: string) => boolean,
): boolean {
	if (!path.startsWith(`${libraryRoot}/`)) {
		return true;
	}
	return isCodexBasename(basenameWithoutExt);
}

/**
 * Handle delete event from vault.
 * Pure function that takes context.
 */
export async function handleDelete(
	path: string,
	isFolder: boolean,
	context: EventHandlerContext,
): Promise<void> {
	// Skip codex files
	const basenameWithoutExt = extractBasenameWithoutExt(path);
	if (
		shouldIgnorePath(
			path,
			basenameWithoutExt,
			context.libraryRoot,
			isCodexBasename,
		)
	) {
		return;
	}

	if (!context.tree) {
		return;
	}

	// Parse path to get coreNameChain
	const coreNameChain = parseDeletePathToChain(
		path,
		isFolder,
		context.libraryRoot,
		context.suffixDelimiter,
	);

	if (!coreNameChain) {
		return;
	}

	const impactedChain = context.tree.applyTreeAction({
		payload: { coreNameChain },
		type: TreeActionType.DeleteNode,
	});

	const impactedSections = dedupeChains(
		expandToAncestors(impactedChain as CoreNameChainFromRoot),
	);

	await regenerateCodexes(impactedSections, {
		dispatch: context.dispatch,
		getNode: context.getNode,
		libraryRoot: context.libraryRoot,
		suffixDelimiter: context.suffixDelimiter,
	});
}

/**
 * Handle a rename event from vault.
 * Pure function that takes context.
 */
export async function handleRename(
	oldPath: string,
	newPath: string,
	isFolder: boolean,
	context: EventHandlerContext,
): Promise<VaultAction[]> {
	const mode = detectRenameMode(
		{ isFolder, newPath, oldPath },
		context.libraryRoot,
	);

	if (!mode) {
		return [];
	}

	// Init mode is handled separately, skip here
	if (mode.mode === "Init") {
		return [];
	}

	const actions = await resolveActions(
		mode as
			| {
					mode: "Runtime";
					subtype: "BasenameOnly" | "PathOnly" | "Both";
			  }
			| { mode: "DragIn"; subtype: "File" | "Folder" },
		oldPath,
		newPath,
		isFolder,
		{
			listAll: context.listAll,
			splitPath: context.splitPath,
		},
		context.libraryRoot,
		context.suffixDelimiter,
	);

	const actionArray = Array.isArray(actions) ? actions : await actions;

	if (actionArray.length > 0) {
		try {
			await context.dispatch(actionArray);
			if (context.tree) {
				const impactedChains = applyActionsToTree(actionArray, {
					libraryRoot: context.libraryRoot,
					suffixDelimiter: context.suffixDelimiter,
					tree: context.tree,
				});
				await regenerateCodexes(impactedChains, {
					dispatch: context.dispatch,
					getNode: context.getNode,
					libraryRoot: context.libraryRoot,
					suffixDelimiter: context.suffixDelimiter,
				});
			}
		} finally {
		}
	} else {
		// No healing needed, but still update tree and codexes for user's rename
		await updateTreeAndCodexesForRename(newPath, context);
	}

	return actionArray;
}

/**
 * Update tree and regenerate codexes for a user rename that needs no healing.
 */
async function updateTreeAndCodexesForRename(
	newPath: string,
	context: EventHandlerContext,
): Promise<void> {
	// Re-read tree to get latest state
	const newTree = await context.readTree();
	context.setTree(newTree);

	// Compute impacted chain from new file location
	const newSplitPath = context.splitPath(newPath);
	if (newSplitPath.type === SplitPathType.Folder) {
		return;
	}

	const parentChain = newSplitPath.pathParts.slice(1);

	const impactedChains = expandToAncestors(parentChain);
	await regenerateCodexes(impactedChains, {
		dispatch: context.dispatch,
		getNode: context.getNode,
		libraryRoot: context.libraryRoot,
		suffixDelimiter: context.suffixDelimiter,
	});
}

/**
 * Handle file creation event.
 * Pure function that takes context.
 */
export async function handleCreate(
	path: string,
	isFolder: boolean,
	context: EventHandlerContext,
): Promise<VaultAction[]> {
	// Ignore folders - we only heal files
	if (isFolder) {
		return [];
	}

	// Ignore files outside library
	if (!path.startsWith(`${context.libraryRoot}/`)) {
		return [];
	}

	// Skip codex files - they're generated, not source data
	const basenameWithoutExt = extractBasenameWithoutExt(path);
	if (isCodexBasename(basenameWithoutExt)) {
		return [];
	}

	const splitPath = context.splitPath(path);

	// Only handle files, not folders
	if (splitPath.type === SplitPathType.Folder) {
		return [];
	}

	const { action, parentChain } = computeCreateAction(
		splitPath,
		context.libraryRoot,
		context.suffixDelimiter,
	);

	if (!action) {
		return [];
	}

	try {
		await context.dispatch([action]);

		// Re-read tree to include the new file
		const newTree = await context.readTree();
		context.setTree(newTree);

		// Expand to ancestors and regenerate codexes
		const impactedChains = expandToAncestors(parentChain);
		await regenerateCodexes(impactedChains, {
			dispatch: context.dispatch,
			getNode: context.getNode,
			libraryRoot: context.libraryRoot,
			suffixDelimiter: context.suffixDelimiter,
		});
	} finally {
	}

	return [action];
}
