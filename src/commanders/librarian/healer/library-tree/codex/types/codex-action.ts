/**
 * Codex actions emitted after tree mutations.
 * Converted to VaultActions for dispatch.
 */

import type { SplitPathToMdFileInsideLibrary } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { SectionNode } from "../../tree-node/types/tree-node";

// ─── Action Types ───

export type CodexActionType =
	| "UpsertCodex"
	| "WriteScrollStatus"
	| "EnsureCodexFileExists"
	| "ProcessCodex";

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

/** Write status to scroll metadata */
export type WriteScrollStatusPayload = {
	/** Target scroll path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Status to write */
	status: TreeNodeStatus;
};

/** Ensure codex file exists (creates if missing, no overwrite) */
export type EnsureCodexFileExistsPayload = {
	/** Target codex path */
	splitPath: SplitPathToMdFileInsideLibrary;
};

/** Process codex (children list only; backlink from backlink-healing) */
export type ProcessCodexPayload = {
	/** Target codex path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Section node for content generation */
	section: SectionNode;
	/** Full section chain */
	sectionChain: SectionNodeSegmentId[];
};

// ─── Actions ───

export type WriteScrollStatusAction = {
	kind: "WriteScrollStatus";
	payload: WriteScrollStatusPayload;
};

export type UpsertCodexAction = {
	kind: "UpsertCodex";
	payload: UpsertCodexPayload;
};

export type EnsureCodexFileExistsAction = {
	kind: "EnsureCodexFileExists";
	payload: EnsureCodexFileExistsPayload;
};

export type ProcessCodexAction = {
	kind: "ProcessCodex";
	payload: ProcessCodexPayload;
};

export type CodexAction =
	| UpsertCodexAction
	| WriteScrollStatusAction
	| EnsureCodexFileExistsAction
	| ProcessCodexAction;
