import type { Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { VaultEvent } from "../../../obsidian-vault-action-manager";
import { systemPathFromSplitPathInternal } from "../../../obsidian-vault-action-manager/helpers/pathfinder/system-path-and-split-path-codec";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import {
	dedupeChains,
	expandAllToAncestors,
	expandToAncestors,
	flattenActionResult,
} from "../codex/impacted-chains";
import { detectRenameMode } from "../healing";
import type { LibraryTreeDeprecated } from "../library-tree";
import { translateVaultAction } from "../reconciliation/vault-to-tree";
import { TreeActionType } from "../types/literals";
import type { NodeNameChain } from "../types/schemas/node-name";
import { isBasenamePrefixedAsCodexDeprecated } from "../utils/codex-utils";
import { resolveActions } from "./action-resolver";
import { buildActionsForCodexRegenerationInImpactedSections } from "./codex-regeneration";
import { computeCreateAction } from "./create-handler";
import {
	extractBasenameWithoutExt,
	parseDeletePathToChain,
} from "./path-parsers";

/** @deprecated  */
export type EventHandlerContextDeprecated = {
	dispatch: (actions: VaultAction[]) => Promise<unknown>;
	readTree: () => Promise<LibraryTreeDeprecated>;
	setTree: (tree: LibraryTreeDeprecated) => void;
	makeSplitPath: (path: string) => SplitPath;
	tree: LibraryTreeDeprecated;
	listAllFilesWithMdReaders: (
		splitPath: import("../../../obsidian-vault-action-manager/types/split-path").SplitPathToFolder,
	) => Promise<
		Result<
			import("../../../obsidian-vault-action-manager/types/split-path").SplitPathWithReader[],
			string
		>
	>;
	getSectionNode: (
		chain: NodeNameChain,
	) => import("../types/tree-node").SectionNode | null;
};

/**
 * Extract handler info from VaultEvent.
 * Pure function that converts events to handler parameters.
 * Reads libraryRoot from global settings.
 * @deprecated
 */
export function parseEventToHandlerDeprecared(event: VaultEvent): {
	type: "rename" | "create" | "delete";
	oldPath?: string;
	newPath?: string;
	path: string;
	isFolder: boolean;
} | null {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	if (event.type === "FileRenamed" || event.type === "FolderRenamed") {
		const oldPath = systemPathFromSplitPathInternal(event.from);
		const newPath = systemPathFromSplitPathInternal(event.to);
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
		const path = systemPathFromSplitPathInternal(event.splitPath);
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

	if (event.type === "FileDeleted" || event.type === "FolderDeleted") {
		const path = systemPathFromSplitPathInternal(event.splitPath);
		// Only handle events within library
		if (!path.startsWith(`${libraryRoot}/`)) {
			return null;
		}
		return {
			isFolder: event.type === "FolderDeleted",
			path,
			type: "delete",
		};
	}

	return null;
}

/**
 * Check if path should be ignored (outside library or codex file).
 * Reads libraryRoot from global settings.
 * @deprecated
 */
export function shouldIgnorePathDeprecated(
	path: string,
	basenameWithoutExt: string,
	isCodexBasename: (basename: string) => boolean,
): boolean {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	if (!path.startsWith(`${libraryRoot}/`)) {
		return true;
	}
	return isCodexBasename(basenameWithoutExt);
}

/**
 * Handle delete event from vault.
 * Pure function that takes context.
 * @deprecated
 */
export async function handleDeleteDeprecated(
	path: string,
	isFolder: boolean,
	context: EventHandlerContextDeprecated,
): Promise<void> {
	// Skip codex files
	const basenameWithoutExt = extractBasenameWithoutExt(path);
	if (
		shouldIgnorePathDeprecated(
			path,
			basenameWithoutExt,
			isBasenamePrefixedAsCodexDeprecated,
		)
	) {
		return;
	}

	if (!context.tree) {
		return;
	}

	// Parse path to get nodeNameChain
	const nodeNameChain = parseDeletePathToChain(path, isFolder);

	if (!nodeNameChain) {
		return;
	}

	const impactedChain = context.tree.applyTreeAction({
		payload: { nodeNameChain },
		type: TreeActionType.DeleteNode,
	});

	// DeleteNode always returns single chain, but use flattenActionResult for type safety
	const chains = flattenActionResult(impactedChain);
	const impactedSections = dedupeChains(expandAllToAncestors(chains));

	const settings = getParsedUserSettings();
	const allFilesResult = await context.listAllFilesWithMdReaders(
		settings.splitPathToLibraryRoot,
	);
	if (allFilesResult.isErr()) {
		return;
	}
	const splitPathsToFiles = allFilesResult.value as SplitPath[];
	const actions = buildActionsForCodexRegenerationInImpactedSections(
		impactedSections,
		splitPathsToFiles,
		context.getSectionNode,
	);
	await context.dispatch(actions);
}

/**
 * Handle a rename event from vault.
 * Pure function that takes context.
 * @deprecated
 */
export async function handleRenameDeprecated(
	oldPath: string,
	newPath: string,
	isFolder: boolean,
	context: EventHandlerContextDeprecated,
): Promise<VaultAction[]> {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	// If a codex file is being renamed, delete it instead (codexes are auto-generated)
	if (!isFolder) {
		const oldBasenameWithoutExt = extractBasenameWithoutExt(oldPath);
		if (isBasenamePrefixedAsCodexDeprecated(oldBasenameWithoutExt)) {
			// Delete the old codex file - regeneration will create new one with correct name
			const oldSplitPath = context.makeSplitPath(oldPath);
			if (oldSplitPath.type === SplitPathType.MdFile) {
				await context.dispatch([
					{
						payload: { splitPath: oldSplitPath },
						type: "TrashMdFile",
					},
				]);
			}
			// Don't process the rename further - codex will be regenerated
			return [];
		}
	}

	const mode = detectRenameMode({ isFolder, newPath, oldPath }, libraryRoot);

	// Handle file moved OUT of library
	if (!mode) {
		const oldInside =
			oldPath.startsWith(`${libraryRoot}/`) || oldPath === libraryRoot;
		const newInside =
			newPath.startsWith(`${libraryRoot}/`) || newPath === libraryRoot;

		// File moved out of library - delete from tree and regenerate codexes
		if (oldInside && !newInside) {
			if (!context.tree) {
				return [];
			}

			// Parse old path to get nodeNameChain
			const nodeNameChain = parseDeletePathToChain(oldPath, isFolder);
			if (!nodeNameChain) {
				return [];
			}

			// Delete node from tree
			const impactedChain = context.tree.applyTreeAction({
				payload: { nodeNameChain },
				type: TreeActionType.DeleteNode,
			});

			// Re-read tree from vault to ensure it matches filesystem state
			const newTree = await context.readTree();
			context.setTree(newTree);

			if (newTree) {
				// Compute impacted sections
				const chains = flattenActionResult(impactedChain);
				const impactedSections = dedupeChains(
					expandAllToAncestors(chains),
				);

				const settings = getParsedUserSettings();
				const allFilesResult = await context.listAllFilesWithMdReaders(
					settings.splitPathToLibraryRoot,
				);
				if (allFilesResult.isErr()) {
					return [];
				}
				const splitPathsToFiles = allFilesResult.value as SplitPath[];
				const actions =
					buildActionsForCodexRegenerationInImpactedSections(
						impactedSections,
						splitPathsToFiles,
						context.getSectionNode,
					);
				await context.dispatch(actions);
			}

			return [];
		}

		// Both paths outside library - not our concern
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
			listAllFilesWithMdReaders: context.listAllFilesWithMdReaders,
			makeSplitPath: context.makeSplitPath,
		},
	);

	const actionArray = Array.isArray(actions) ? actions : await actions;

	if (actionArray.length > 0) {
		try {
			await context.dispatch(actionArray);

			// Re-read tree from vault to ensure it matches filesystem state
			const newTree = await context.readTree();
			context.setTree(newTree);

			if (newTree) {
				// Compute impacted chains from actions (extract parent chains from paths)
				const impactedChains =
					computeImpactedChainsFromActionsDeprecated(actionArray);
				const settings = getParsedUserSettings();
				const allFilesResult = await context.listAllFilesWithMdReaders(
					settings.splitPathToLibraryRoot,
				);
				if (allFilesResult.isErr()) {
					return [];
				}
				const splitPathsToFiles = allFilesResult.value as SplitPath[];
				const actions =
					buildActionsForCodexRegenerationInImpactedSections(
						impactedChains,
						splitPathsToFiles,
						context.getSectionNode,
					);
				await context.dispatch(actions);
			}
		} finally {
		}
	} else {
		// No healing needed, but still update tree and codexes for user's rename
		await updateTreeAndCodexesForRenameDeprecated(newPath, context);
	}

	return actionArray;
}

/**
 * Compute impacted section chains from vault actions without applying them to tree.
 * Extracts parent chains from action paths.
 * @deprecated
 */
function computeImpactedChainsFromActionsDeprecated(
	actions: VaultAction[],
): NodeNameChain[] {
	const chains: NodeNameChain[] = [];

	for (const action of actions) {
		const treeAction = translateVaultAction(action);
		if (!treeAction) continue;

		if (treeAction.type === TreeActionType.MoveNode) {
			// MoveNode: old parent, new parent, and moved node itself are impacted
			const oldParent = treeAction.payload.nodeNameChain.slice(0, -1);
			const newParent = treeAction.payload.newNodeNameChainToParent;
			// Compute new chain for moved node: [newParent..., nodeName]
			const nodeName =
				treeAction.payload.nodeNameChain[
					treeAction.payload.nodeNameChain.length - 1
				];

			const movedNodeChain = [...newParent, nodeName].filter(
				Boolean,
			) as NodeNameChain;

			chains.push(oldParent, newParent, movedNodeChain);
		} else if (treeAction.type === TreeActionType.ChangeNodeName) {
			// ChangeNodeName: parent chain is impacted
			const parent = treeAction.payload.nodeNameChain.slice(0, -1);
			chains.push(parent);
		} else if (treeAction.type === TreeActionType.CreateNode) {
			// CreateNode: parent chain is impacted
			chains.push(treeAction.payload.nodeNameChainToParent);
		} else if (treeAction.type === TreeActionType.DeleteNode) {
			// DeleteNode: parent chain is impacted
			const parent = treeAction.payload.nodeNameChain.slice(0, -1);
			chains.push(parent);
		}
	}

	// Expand to ancestors and dedupe
	const expanded = expandAllToAncestors(chains);
	return dedupeChains(expanded);
}

/**
 * Update tree and regenerate codexes for a user rename that needs no healing.
 * @deprecated
 */
async function updateTreeAndCodexesForRenameDeprecated(
	newPath: string,
	context: EventHandlerContextDeprecated,
): Promise<void> {
	// Re-read tree to get latest state
	const newTree = await context.readTree();
	context.setTree(newTree);

	// Compute impacted chain from new file location
	const newSplitPath = context.makeSplitPath(newPath);
	if (newSplitPath.type === SplitPathType.Folder) {
		return;
	}

	const parentChain = newSplitPath.pathParts.slice(1);

	const impactedChains = expandToAncestors(parentChain);
	const settings = getParsedUserSettings();
	const allFilesResult = await context.listAllFilesWithMdReaders(
		settings.splitPathToLibraryRoot,
	);
	if (allFilesResult.isErr()) {
		return;
	}
	const splitPathsToFiles = allFilesResult.value as SplitPath[];
	const actions = buildActionsForCodexRegenerationInImpactedSections(
		impactedChains,
		splitPathsToFiles,
		context.getSectionNode,
	);
	await context.dispatch(actions);
}

/**
 * Handle file creation event.
 * Pure function that takes context.
 * @deprecated
 */
export async function handleCreateDeprecated(
	path: string,
	isFolder: boolean,
	context: EventHandlerContextDeprecated,
): Promise<VaultAction[]> {
	// Ignore folders - we only heal files
	if (isFolder) {
		return [];
	}

	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	// Ignore files outside library
	if (!path.startsWith(`${libraryRoot}/`)) {
		return [];
	}

	// Skip codex files - they're generated, not source data
	const basenameWithoutExt = extractBasenameWithoutExt(path);
	if (isBasenamePrefixedAsCodexDeprecated(basenameWithoutExt)) {
		return [];
	}

	const splitPath = context.makeSplitPath(path);

	// Only handle files, not folders
	if (splitPath.type === SplitPathType.Folder) {
		return [];
	}

	const { action, parentChain } = computeCreateAction(splitPath);

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
		const settings = getParsedUserSettings();
		const allFilesResult = await context.listAllFilesWithMdReaders(
			settings.splitPathToLibraryRoot,
		);
		if (allFilesResult.isErr()) {
			return [action];
		}
		const splitPathsToFiles = allFilesResult.value as SplitPath[];
		const actions = buildActionsForCodexRegenerationInImpactedSections(
			impactedChains,
			splitPathsToFiles,
			context.getSectionNode,
		);
		await context.dispatch(actions);
	} finally {
	}

	return [action];
}
