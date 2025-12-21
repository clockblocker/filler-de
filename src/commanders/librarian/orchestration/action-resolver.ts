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
	type DragInResult,
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
 * Pure function.
 */
export function resolveDragInActions(
	newPath: string,
	subtype: DragInSubtype,
	splitPath: (
		path: string,
	) => SplitPathToFile | SplitPathToMdFile | SplitPathToFolder,
	libraryRoot: string,
	suffixDelimiter: string,
): VaultAction[] {
	const path = splitPath(newPath);
	const result: DragInResult = handleDragIn(
		subtype,
		path,
		libraryRoot,
		suffixDelimiter,
	);
	return result.actions;
}

/**
 * Resolve Mode 1 (Runtime) actions for folder rename.
 * Returns actions to heal all files in folder.
 */
export async function resolveFolderRenameActions(
	folderPath: SplitPathToFolder,
	context: ActionResolverContext,
	libraryRoot: string,
	suffixDelimiter: string,
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
			libraryRoot,
			suffixDelimiter,
		);

		if (intent) {
			actions.push(...intentToActions(intent));
		}
	}

	return actions;
}

/**
 * Resolve Mode 1 (Runtime) actions for file rename.
 * Pure function.
 */
export function resolveRuntimeActions(
	oldPath: string,
	newPath: string,
	subtype: RuntimeSubtype,
	isFolder: boolean,
	context: ActionResolverContext,
	libraryRoot: string,
	suffixDelimiter: string,
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
			return resolveFolderRenameActions(
				newSplitPath,
				context,
				libraryRoot,
				suffixDelimiter,
			);
		}
		return [];
	}

	const intent = resolveRuntimeIntent(
		oldSplitPath as SplitPathToFile | SplitPathToMdFile,
		newSplitPath as SplitPathToFile | SplitPathToMdFile,
		subtype,
		libraryRoot,
		suffixDelimiter,
	);

	if (!intent) {
		return [];
	}

	return intentToActions(intent);
}

/**
 * Resolve actions based on detected mode.
 */
export function resolveActions(
	mode: { mode: HealingMode; subtype: RuntimeSubtype | DragInSubtype },
	oldPath: string,
	newPath: string,
	isFolder: boolean,
	context: ActionResolverContext,
	libraryRoot: string,
	suffixDelimiter: string,
): VaultAction[] | Promise<VaultAction[]> {
	switch (mode.mode) {
		case HealingMode.Runtime:
			return resolveRuntimeActions(
				oldPath,
				newPath,
				mode.subtype as RuntimeSubtype,
				isFolder,
				context,
				libraryRoot,
				suffixDelimiter,
			);

		case HealingMode.DragIn:
			return resolveDragInActions(
				newPath,
				mode.subtype as DragInSubtype,
				context.splitPath,
				libraryRoot,
				suffixDelimiter,
			);

		case HealingMode.Init:
			// Init is handled separately via init()
			return [];
	}
}
