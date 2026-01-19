/**
 * Action Helpers - Utility functions for working with VaultActions.
 *
 * This module provides helper functions that eliminate the need for
 * switch statements when working with VaultActions. The 9-case union
 * requires switches in 6+ places; these helpers consolidate that logic.
 *
 * Benefits:
 * - Single place to update when action types change
 * - Type-safe narrowing without manual switches
 * - Consistent path extraction logic
 * - Easier testing and maintenance
 */

import type { AnySplitPath } from "../types/split-path";
import { type VaultAction, VaultActionKind } from "../types/vault-action";

// ─── Operation Classification ───

/**
 * Check if action creates a resource (folder, file, or md file).
 */
export function isCreateAction(action: VaultAction): boolean {
	return (
		action.kind === VaultActionKind.CreateFolder ||
		action.kind === VaultActionKind.CreateFile ||
		action.kind === VaultActionKind.UpsertMdFile
	);
}

// ─── Action Type Aliases for Type Predicates ───

type RenameAction = Extract<
	VaultAction,
	| { kind: typeof VaultActionKind.RenameFolder }
	| { kind: typeof VaultActionKind.RenameMdFile }
	| { kind: typeof VaultActionKind.RenameFile }
>;

type TrashAction = Extract<
	VaultAction,
	| { kind: typeof VaultActionKind.TrashFolder }
	| { kind: typeof VaultActionKind.TrashFile }
	| { kind: typeof VaultActionKind.TrashMdFile }
>;

type ProcessAction = Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.ProcessMdFile }
>;

type UpsertMdFileAction = Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.UpsertMdFile }
>;

/**
 * Check if action renames a resource.
 */
export function isRenameAction(action: VaultAction): action is RenameAction {
	return (
		action.kind === VaultActionKind.RenameFolder ||
		action.kind === VaultActionKind.RenameMdFile ||
		action.kind === VaultActionKind.RenameFile
	);
}

/**
 * Check if action deletes/trashes a resource.
 */
export function isTrashAction(action: VaultAction): action is TrashAction {
	return (
		action.kind === VaultActionKind.TrashFolder ||
		action.kind === VaultActionKind.TrashFile ||
		action.kind === VaultActionKind.TrashMdFile
	);
}

/**
 * Check if action processes content (modifies without creating/renaming).
 */
export function isProcessAction(action: VaultAction): action is ProcessAction {
	return action.kind === VaultActionKind.ProcessMdFile;
}

/**
 * Check if action upserts a markdown file.
 */
export function isUpsertMdFileAction(
	action: VaultAction,
): action is UpsertMdFileAction {
	return action.kind === VaultActionKind.UpsertMdFile;
}

/**
 * Check if action operates on a folder.
 */
export function isFolderAction(action: VaultAction): boolean {
	return (
		action.kind === VaultActionKind.CreateFolder ||
		action.kind === VaultActionKind.RenameFolder ||
		action.kind === VaultActionKind.TrashFolder
	);
}

/**
 * Check if action operates on a markdown file.
 */
export function isMdFileAction(action: VaultAction): boolean {
	return (
		action.kind === VaultActionKind.UpsertMdFile ||
		action.kind === VaultActionKind.RenameMdFile ||
		action.kind === VaultActionKind.TrashMdFile ||
		action.kind === VaultActionKind.ProcessMdFile
	);
}

/**
 * Check if action operates on a non-markdown file.
 */
export function isFileAction(action: VaultAction): boolean {
	return (
		action.kind === VaultActionKind.CreateFile ||
		action.kind === VaultActionKind.RenameFile ||
		action.kind === VaultActionKind.TrashFile
	);
}

// ─── Path Extraction ───

/**
 * Get the primary path from an action.
 * For rename actions, returns the 'from' path.
 */
export function getActionPath(action: VaultAction): string[] {
	switch (action.kind) {
		case VaultActionKind.CreateFolder:
		case VaultActionKind.TrashFolder:
			return [
				...action.payload.splitPath.pathParts,
				action.payload.splitPath.basename,
			];

		case VaultActionKind.CreateFile:
		case VaultActionKind.TrashFile:
			return [
				...action.payload.splitPath.pathParts,
				`${action.payload.splitPath.basename}.${action.payload.splitPath.extension}`,
			];

		case VaultActionKind.UpsertMdFile:
		case VaultActionKind.TrashMdFile:
		case VaultActionKind.ProcessMdFile:
			return [
				...action.payload.splitPath.pathParts,
				`${action.payload.splitPath.basename}.md`,
			];

		case VaultActionKind.RenameFolder:
			return [
				...action.payload.from.pathParts,
				action.payload.from.basename,
			];

		case VaultActionKind.RenameMdFile:
			return [
				...action.payload.from.pathParts,
				`${action.payload.from.basename}.md`,
			];

		case VaultActionKind.RenameFile:
			return [
				...action.payload.from.pathParts,
				`${action.payload.from.basename}.${action.payload.from.extension}`,
			];
	}
}

/**
 * Get the target path from a rename action (the 'to' path).
 * Returns undefined for non-rename actions.
 */
export function getRenameTargetPath(action: VaultAction): string[] | undefined {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
			return [...action.payload.to.pathParts, action.payload.to.basename];

		case VaultActionKind.RenameMdFile:
			return [
				...action.payload.to.pathParts,
				`${action.payload.to.basename}.md`,
			];

		case VaultActionKind.RenameFile:
			return [
				...action.payload.to.pathParts,
				`${action.payload.to.basename}.${action.payload.to.extension}`,
			];

		default:
			return undefined;
	}
}

/**
 * Get the split path from an action.
 * For rename actions, returns the 'from' split path.
 */
export function getActionSplitPath(action: VaultAction): AnySplitPath {
	switch (action.kind) {
		case VaultActionKind.CreateFolder:
		case VaultActionKind.TrashFolder:
		case VaultActionKind.CreateFile:
		case VaultActionKind.TrashFile:
		case VaultActionKind.UpsertMdFile:
		case VaultActionKind.TrashMdFile:
		case VaultActionKind.ProcessMdFile:
			return action.payload.splitPath;

		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameMdFile:
		case VaultActionKind.RenameFile:
			return action.payload.from;
	}
}

/**
 * Get the parent directory path parts from an action.
 */
export function getParentPathParts(action: VaultAction): string[] {
	const splitPath = getActionSplitPath(action);
	return splitPath.pathParts;
}

/**
 * Get the path depth (number of segments) for an action.
 */
export function getPathDepth(action: VaultAction): number {
	return getActionPath(action).length;
}

// ─── Action Identification ───

/**
 * Get a unique key for an action based on its path.
 * Used for deduplication and dependency tracking.
 */
export function getActionKey(action: VaultAction): string {
	const path = getActionPath(action);
	return `${action.kind}:${path.join("/")}`;
}

/**
 * Check if two actions operate on the same path.
 */
export function actionsSharePath(a: VaultAction, b: VaultAction): boolean {
	const pathA = getActionPath(a);
	const pathB = getActionPath(b);
	if (pathA.length !== pathB.length) return false;
	return pathA.every((part, i) => part === pathB[i]);
}

// ─── Type Narrowing ───

type FolderAction = Extract<
	VaultAction,
	{
		kind:
			| typeof VaultActionKind.CreateFolder
			| typeof VaultActionKind.RenameFolder
			| typeof VaultActionKind.TrashFolder;
	}
>;

type MdFileAction = Extract<
	VaultAction,
	{
		kind:
			| typeof VaultActionKind.UpsertMdFile
			| typeof VaultActionKind.RenameMdFile
			| typeof VaultActionKind.TrashMdFile
			| typeof VaultActionKind.ProcessMdFile;
	}
>;

type FileAction = Extract<
	VaultAction,
	{
		kind:
			| typeof VaultActionKind.CreateFile
			| typeof VaultActionKind.RenameFile
			| typeof VaultActionKind.TrashFile;
	}
>;

type RenameActionType = Extract<
	VaultAction,
	{
		kind:
			| typeof VaultActionKind.RenameFolder
			| typeof VaultActionKind.RenameMdFile
			| typeof VaultActionKind.RenameFile;
	}
>;

/**
 * Type guard: narrow to folder actions.
 */
export function asFolderAction(action: VaultAction): FolderAction | undefined {
	if (isFolderAction(action)) {
		return action as FolderAction;
	}
	return undefined;
}

/**
 * Type guard: narrow to md file actions.
 */
export function asMdFileAction(action: VaultAction): MdFileAction | undefined {
	if (isMdFileAction(action)) {
		return action as MdFileAction;
	}
	return undefined;
}

/**
 * Type guard: narrow to file actions.
 */
export function asFileAction(action: VaultAction): FileAction | undefined {
	if (isFileAction(action)) {
		return action as FileAction;
	}
	return undefined;
}

/**
 * Type guard: narrow to rename actions.
 */
export function asRenameAction(
	action: VaultAction,
): RenameActionType | undefined {
	if (isRenameAction(action)) {
		return action as RenameActionType;
	}
	return undefined;
}

// ─── Namespace Export ───

export const ActionHelpers = {
	actionsSharePath,
	asFileAction,

	// Type narrowing
	asFolderAction,
	asMdFileAction,
	asRenameAction,

	// Identification
	getActionKey,

	// Path extraction
	getActionPath,
	getActionSplitPath,
	getParentPathParts,
	getPathDepth,
	getRenameTargetPath,
	// Classification
	isCreateAction,
	isFileAction,
	isFolderAction,
	isMdFileAction,
	isProcessAction,
	isRenameAction,
	isTrashAction,
	isUpsertMdFileAction,
};
