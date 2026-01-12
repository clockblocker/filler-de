/**
 * Codex actions emitted after tree mutations.
 * Converted to VaultActions for dispatch.
 */

import type { SplitPathToMdFileInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../../tree-node/types/node-segment-id";

// ─── Action Types ───

export type CodexActionType =
	| "UpsertCodex"
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

export type DeleteCodexAction = {
	kind: "DeleteCodex";
	payload: DeleteCodexPayload;
};

export type WriteScrollStatusAction = {
	kind: "WriteScrollStatus";
	payload: WriteScrollStatusPayload;
};

export type UpsertCodexAction = {
	kind: "UpsertCodex";
	payload: UpsertCodexPayload;
};

export type CodexAction =
	| UpsertCodexAction
	| DeleteCodexAction
	| WriteScrollStatusAction;
