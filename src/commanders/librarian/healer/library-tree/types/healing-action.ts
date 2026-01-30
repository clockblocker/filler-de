/**
 * Library-scoped healing actions emitted by Healer.
 * Librarian converts these to VaultActions before dispatch.
 * Note: No CreateFolder - VAM auto-creates folders.
 */

import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../codecs";

// ─── Healing Action Types ───

export type HealingActionType =
	| "RenameFolder"
	| "RenameFile"
	| "RenameMdFile"
	| "DeleteMdFile";

// ─── Payloads ───

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

export type DeleteMdFileHealingPayload = {
	splitPath: SplitPathToMdFileInsideLibrary;
};

// ─── Healing Actions ───

export type RenameFolderHealingAction = {
	kind: "RenameFolder";
	payload: RenameFolderHealingPayload;
};

export type RenameFileHealingAction = {
	kind: "RenameFile";
	payload: RenameFileHealingPayload;
};

export type RenameMdFileHealingAction = {
	kind: "RenameMdFile";
	payload: RenameMdFileHealingPayload;
};

export type DeleteMdFileHealingAction = {
	kind: "DeleteMdFile";
	payload: DeleteMdFileHealingPayload;
};

export type HealingAction =
	| RenameFolderHealingAction
	| RenameFileHealingAction
	| RenameMdFileHealingAction
	| DeleteMdFileHealingAction;
