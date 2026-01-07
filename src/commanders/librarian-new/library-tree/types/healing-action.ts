/**
 * Library-scoped healing actions emitted by LibraryTree.
 * Librarian converts these to VaultActions before dispatch.
 */

import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

// ─── Healing Action Types ───

export type HealingActionType =
	| "CreateFolder"
	| "RenameFolder"
	| "RenameFile"
	| "RenameMdFile";

// ─── Payloads ───

export type CreateFolderHealingPayload = {
	splitPath: SplitPathToFolderInsideLibrary;
};

export type RenameFolderHealingPayload = {
	from: SplitPathToFolderInsideLibrary;
	to: SplitPathToFolderInsideLibrary;
};

export type RenameFileHealingPayload = {
	from: SplitPathToFileInsideLibrary;
	to: SplitPathToFileInsideLibrary;
};

export type RenameMdFileHealingPayload = {
	from: SplitPathToMdFileInsideLibrary;
	to: SplitPathToMdFileInsideLibrary;
};

// ─── Healing Actions ───

export type CreateFolderHealingAction = {
	type: "CreateFolder";
	payload: CreateFolderHealingPayload;
};

export type RenameFolderHealingAction = {
	type: "RenameFolder";
	payload: RenameFolderHealingPayload;
};

export type RenameFileHealingAction = {
	type: "RenameFile";
	payload: RenameFileHealingPayload;
};

export type RenameMdFileHealingAction = {
	type: "RenameMdFile";
	payload: RenameMdFileHealingPayload;
};

export type HealingAction =
	| CreateFolderHealingAction
	| RenameFolderHealingAction
	| RenameFileHealingAction
	| RenameMdFileHealingAction;

