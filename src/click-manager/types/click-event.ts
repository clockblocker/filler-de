/**
 * Click events emitted by ClickManager.
 */

import type { TreeNodeStatus } from "../../commanders/librarian-new/library-tree/tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../../commanders/librarian-new/library-tree/tree-node/types/node-segment-id";

// ─── Event Types ───

export type ClickEventType = "CodexCheckboxClicked";

// ─── Events ───

/**
 * Emitted when a checkbox in a codex file is clicked.
 */
export type CodexCheckboxClickedEvent = {
	type: "CodexCheckboxClicked";
	/** Target node chain (parsed from link in same line) */
	targetChain: SectionNodeSegmentId[];
	/** New status (after click — checkbox.checked) */
	newStatus: TreeNodeStatus;
	/** The checkbox element */
	checkbox: HTMLInputElement;
};

export type ClickEvent = CodexCheckboxClickedEvent;

// ─── Handler ───

export type ClickEventHandler = (event: ClickEvent) => void;
