/**
 * TreeReader/TreeWriter/TreeFacade interfaces.
 *
 * Separates read and write concerns for the library tree.
 * Consumers that only need read access (codex impact, validation) use TreeReader.
 * Consumers that mutate the tree use TreeWriter.
 * The Tree class implements TreeFacade (both interfaces).
 */

import type { SectionNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import type { TreeAction } from "./tree-action/types/tree-action";
import type { SectionNode, TreeNode } from "./tree-node/types/tree-node";

// ─── Read Interface ───

/**
 * Read-only access to the library tree.
 * Use this interface for consumers that don't mutate the tree.
 */
export type TreeReader = {
	/** Find section by segment ID chain. Returns undefined if not found. */
	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined;

	/** Get the root section node. */
	getRoot(): SectionNode;
};

// ─── Write Interface ───

/**
 * Result of applying an action to the tree.
 * `changed` indicates if the tree state was actually modified.
 */
export type TreeApplyResult = {
	changed: boolean;
	node: TreeNode | null;
};

/**
 * Mutating access to the library tree.
 * Use this interface for consumers that modify the tree structure.
 */
export type TreeWriter = {
	/**
	 * Apply a tree action, mutating the tree structure.
	 * Returns { changed, node } where:
	 * - changed: true if tree was actually modified, false if already in target state
	 * - node: the affected node (or null for delete)
	 */
	apply(action: TreeAction): TreeApplyResult;

	/**
	 * Ensure a chain of sections exists, creating missing ones.
	 * Returns the deepest section in the chain.
	 */
	ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode;
};

// ─── Combined Interface ───

/**
 * Full access to the library tree (read + write).
 * The Tree class implements this interface.
 */
export type TreeFacade = TreeReader & TreeWriter;
