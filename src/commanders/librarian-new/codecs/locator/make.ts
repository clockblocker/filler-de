import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type { CanonicalSplitPathInsideLibraryOf } from "../split-path-with-separated-suffix";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
import type { SegmentIdCodecs } from "../segment-id";
import type {
	CorrespondingSplitPathKind,
	CorrespondingTreeNodeKind,
} from "../types/type-mappings";
import { canonicalSplitPathInsideLibraryToLocator } from "./internal/from";
import { locatorToCanonicalSplitPathInsideLibrary } from "./internal/to";
import type { NodeLocatorOf } from "./types";

export type LocatorCodecs = {
	locatorToCanonicalSplitPathInsideLibrary: <NK extends TreeNodeKind>(
		loc: NodeLocatorOf<NK>,
	) => Result<
		CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>,
		CodecError
	>;
	canonicalSplitPathInsideLibraryToLocator: <SK extends SplitPathKind>(
		sp: CanonicalSplitPathInsideLibraryOf<SK>,
	) => Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
};

export function makeLocatorCodecs(
	_segmentId: SegmentIdCodecs,
	_suffix: SuffixCodecs,
): LocatorCodecs {
	return {
		canonicalSplitPathInsideLibraryToLocator: (sp) =>
			canonicalSplitPathInsideLibraryToLocator(_segmentId, sp),
		locatorToCanonicalSplitPathInsideLibrary: (loc) =>
			locatorToCanonicalSplitPathInsideLibrary(_segmentId, _suffix, loc),
	};
}
