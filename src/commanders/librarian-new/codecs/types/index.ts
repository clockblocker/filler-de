/**
 * Centralized common type helpers for codecs.
 * Re-exports all generic helpers from type-mappings and codec-specific types.
 */

export type { CanonicalSplitPathInsideLibraryOf } from "../canonical-split-path/types/canonical-split-path";
export type { NodeLocatorOf } from "../locator/types/index";
export type { SegmentIdOf } from "../segment-id/types";
export type {
	CorrespondingSplitPathKind,
	CorrespondingTreeNodeKind,
	SegmentIdComponents,
	SplitPathForTreeNodeKind,
	TreeNodeKindForSplitPath,
} from "./type-mappings";

export { TreeNodeKindToSplitPathKind } from "./type-mappings";
