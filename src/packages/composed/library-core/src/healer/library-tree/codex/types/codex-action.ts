/**
 * Codex actions emitted after tree mutations.
 * Converted to VaultActions for dispatch.
 */

import type { SplitPathToMdFileInsideLibrary } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import type { TreeNodeStatus } from "../../tree-node/types/atoms";
import type { SectionNode } from "../../tree-node/types/tree-node";

// ─── Payloads ───

/** Create or update codex file content */
type UpsertCodexPayload = {
	/** Section chain (for tree lookup) */
	sectionChain: SectionNodeSegmentId[];
	/** Target path for codex file */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Generated markdown content */
	content: string;
};

/** Write status to scroll metadata */
type WriteScrollStatusPayload = {
	/** Target scroll path */
	splitPath: SplitPathToMdFileInsideLibrary;
	/** Status to write */
	status: TreeNodeStatus;
};

/** Ensure codex file exists (creates if missing, no overwrite) */
type EnsureCodexFileExistsPayload = {
	/** Target codex path */
	splitPath: SplitPathToMdFileInsideLibrary;
};

/** Process the complete codex projection, including its parent backlink. */
type ProcessCodexPayload = {
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
