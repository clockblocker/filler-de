import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import {
	handleDragIn,
	type RenameIntent,
	resolveRuntimeIntent,
} from "../healing";
import {
	type DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "../types/literals";

export type ActionResolverContext = {
	splitPath: (
		path: string,
	) => SplitPathToFile | SplitPathToMdFile | SplitPathToFolder;
	listAllFilesWithMdReaders: (
		splitPath: SplitPathToFolder,
	) => Promise<SplitPathWithReader[]>;
};

/**
 * Convert RenameIntent to VaultActions.
 * Pure function.
 */
export function intentToActions(intent: RenameIntent): VaultAction[] {
	if (intent.from.type === SplitPathType.MdFile) {
		return [
			{
				payload: {
					from: intent.from as SplitPathToMdFile,
					to: intent.to as SplitPathToMdFile,
				},
				type: VaultActionType.RenameMdFile,
			},
		];
	}

	return [
		{
			payload: {
				from: intent.from as SplitPathToFile,
				to: intent.to as SplitPathToFile,
			},
			type: VaultActionType.RenameFile,
		},
	];
}

/**
 * Resolve Mode 3 (DragIn) actions.
 * Pure function. Reads libraryRoot from global settings.
 */
export function resolveDragInActions(
	newPath: string,
	subtype: DragInSubtype,
	splitPath: (
		path: string,
	) => SplitPathToFile | SplitPathToMdFile | SplitPathToFolder,
): VaultAction[] {
	const path = splitPath(newPath);
	const result = handleDragIn(subtype, path);
	return result.actions;
}

/**
 * Resolve Mode 1 (Runtime) actions for folder rename.
 * Returns actions to heal all files in folder.
 * Reads libraryRoot and suffixDelimiter from global settings.
 */
export async function resolveFolderRenameActions(
	folderPath: SplitPathToFolder,
	context: ActionResolverContext,
): Promise<VaultAction[]> {
	const allEntries = await context.listAllFilesWithMdReaders(folderPath);
	const fileEntries = allEntries.filter(
		(entry): entry is SplitPathWithReader =>
			entry.type === SplitPathType.File ||
			entry.type === SplitPathType.MdFile,
	);

	const actions: VaultAction[] = [];

	for (const entry of fileEntries) {
		// For each file, compute expected suffix from its current path
		const intent = resolveRuntimeIntent(
			entry, // "from" - same as current path (we don't know old path)
			entry, // "to" - current path
			RuntimeSubtype.PathOnly, // Path changed, fix suffix
		);

		if (intent) {
			actions.push(...intentToActions(intent));
		}
	}

	return actions;
}

/**
 * Resolve Mode 1 (Runtime) actions for file rename.
 * Pure function. Reads libraryRoot and suffixDelimiter from global settings.
 */
export function resolveRuntimeActions(
	oldPath: string,
	newPath: string,
	subtype: RuntimeSubtype,
	isFolder: boolean,
	context: ActionResolverContext,
): VaultAction[] | Promise<VaultAction[]> {
	const oldSplitPath = context.splitPath(oldPath);
	const newSplitPath = context.splitPath(newPath);

	// Folder renames: handled via resolveFolderRenameActions
	if (
		isFolder ||
		oldSplitPath.type === SplitPathType.Folder ||
		newSplitPath.type === SplitPathType.Folder
	) {
		if (newSplitPath.type === SplitPathType.Folder) {
			return resolveFolderRenameActions(newSplitPath, context);
		}
		return [];
	}

	const intent = resolveRuntimeIntent(
		oldSplitPath as SplitPathToFile | SplitPathToMdFile,
		newSplitPath as SplitPathToFile | SplitPathToMdFile,
		subtype,
	);

	if (!intent) {
		return [];
	}

	return intentToActions(intent);
}

/**
 * Resolve actions based on detected mode.
 * Reads libraryRoot and suffixDelimiter from global settings.
 */
export function resolveActions(
	mode: { mode: HealingMode; subtype: RuntimeSubtype | DragInSubtype },
	oldPath: string,
	newPath: string,
	isFolder: boolean,
	context: ActionResolverContext,
): VaultAction[] | Promise<VaultAction[]> {
	switch (mode.mode) {
		case HealingMode.Runtime:
			return resolveRuntimeActions(
				oldPath,
				newPath,
				mode.subtype as RuntimeSubtype,
				isFolder,
				context,
			);

		case HealingMode.DragIn:
			return resolveDragInActions(
				newPath,
				mode.subtype as DragInSubtype,
				context.splitPath,
			);

		case HealingMode.Init:
			// Init is handled separately via init()
			return [];
	}
}
