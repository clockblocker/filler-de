/**
 * Codex actions emitted after tree mutations.
 * Converted to VaultActions for dispatch.
 */

import type { SplitPathToMdFileInsideLibrary } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import type { SectionNode } from "../../tree-node/types/tree-node";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";

// ─── Action Types ───

export type CodexActionType =
	| "UpsertCodex"
	| "WriteScrollStatus"
	| "EnsureCodexFileExists"
	| "ProcessCodex"
	| "ProcessScrollBacklink";

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

/** Process codex (backlink + children list combined) */
export type ProcessCodexPayload = {
	/** Target codex path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Section node for content generation */
	section: SectionNode;
	/** Full section chain */
	sectionChain: SectionNodeSegmentId[];
};

/** Process scroll backlink (line 1) */
export type ProcessScrollBacklinkPayload = {
	/** Target scroll path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Parent chain for backlink generation */
	parentChain: SectionNodeSegmentId[];
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

export type ProcessScrollBacklinkAction = {
	kind: "ProcessScrollBacklink";
	payload: ProcessScrollBacklinkPayload;
};

export type CodexAction =
	| UpsertCodexAction
	| WriteScrollStatusAction
	| EnsureCodexFileExistsAction
	| ProcessCodexAction
	| ProcessScrollBacklinkAction;
