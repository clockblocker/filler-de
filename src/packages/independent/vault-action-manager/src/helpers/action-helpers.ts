/**
 * Action Helpers - Utility functions for working with VaultActions.
 */

import type { AnySplitPath } from "../types/split-path";
import { type VaultAction, VaultActionKind } from "../types/vault-action";

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

// ─── Operation Classification ───

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

// ─── Path Extraction ───

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
