/**
 * TreeNode ↔ SegmentId adapter codecs.
 * Thin adapter layer that uses centralized codecs internally.
 */

export type { TreeNodeCodecs } from "./tree-node-segment-id-codec";
export { makeTreeNodeCodecs } from "./tree-node-segment-id-codec";
export { tryParseTreeNode } from "./try-parse-tree-node";

// Re-export old functions for backward compatibility during migration
// These will be removed in Phase 7 (Final Migration)
export { makeNodeSegmentId } from "./make-node-segment-id";
export { makeTreeNode } from "./optimistic-makers/make-tree-node";
