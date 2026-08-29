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


// ─── Payloads ───

type RenameFolderHealingPayload = {
	from: SplitPathToFolderInsideLibrary;
	to: SplitPathToFolderInsideLibrary;
};

type RenameFileHealingPayload = {
	from: SplitPathToFileInsideLibrary;
	to: SplitPathToFileInsideLibrary;
};

type RenameMdFileHealingPayload = {
	from: SplitPathToMdFileInsideLibrary;
	to: SplitPathToMdFileInsideLibrary;
};

type DeleteMdFileHealingPayload = {
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
