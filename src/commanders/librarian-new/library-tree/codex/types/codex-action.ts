/**
 * Codex actions emitted after tree mutations.
 * Converted to VaultActions for dispatch.
 */

import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../../tree-node/types/node-segment-id";
import type { SplitPathToMdFileInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

// ─── Action Types ───

export type CodexActionType =
	| "CreateCodex"
	| "UpdateCodex"
	| "RenameCodex"
	| "DeleteCodex"
	| "WriteScrollStatus";

// ─── Payloads ───

/** Create or update codex file content */
export type UpsertCodexPayload = {
	/** Section chain (for tree lookup) */
	sectionChain: SectionNodeSegmentId[];
	/** Target path for codex file */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Generated markdown content */
	content: string;
};

/** Rename/move codex file */
export type RenameCodexPayload = {
	from: SplitPathToMdFileInsideLibrary;
	to: SplitPathToMdFileInsideLibrary;
};

/** Delete codex file */
export type DeleteCodexPayload = {
	splitPath: SplitPathToMdFileInsideLibrary;
};

/** Write status to scroll metadata */
export type WriteScrollStatusPayload = {
	/** Target scroll path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Status to write */
	status: TreeNodeStatus;
};

// ─── Actions ───

export type CreateCodexAction = {
	type: "CreateCodex";
	payload: UpsertCodexPayload;
};

export type UpdateCodexAction = {
	type: "UpdateCodex";
	payload: UpsertCodexPayload;
};

export type RenameCodexAction = {
	type: "RenameCodex";
	payload: RenameCodexPayload;
};

export type DeleteCodexAction = {
	type: "DeleteCodex";
	payload: DeleteCodexPayload;
};

export type WriteScrollStatusAction = {
	type: "WriteScrollStatus";
	payload: WriteScrollStatusPayload;
};

export type CodexAction =
	| CreateCodexAction
	| UpdateCodexAction
	| RenameCodexAction
	| DeleteCodexAction
	| WriteScrollStatusAction;
