/**
 * Centralized common type helpers for codecs.
 * Re-exports all generic helpers from type-mappings.
 */
export type {
	CanonicalSplitPathInsideLibraryOf,
	CorrespondingSplitPathKind,
	CorrespondingTreeNodeKind,
	NodeLocatorOf,
	SegmentIdComponents,
	SegmentIdOf,
	SplitPathForTreeNodeKind,
	SplitPathInsideLibraryOf,
	TreeNodeKindForSplitPath,
} from "./type-mappings";

export { TreeNodeKindToSplitPathKind } from "./type-mappings";
