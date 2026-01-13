import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type { CanonicalSplitPathCodecs } from "../canonical-split-path";
import type { CanonicalSplitPathInsideLibraryOf } from "../canonical-split-path/types/canonical-split-path";
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
	_canonicalSplitPath: CanonicalSplitPathCodecs,
	_suffix: SuffixCodecs,
): LocatorCodecs {
	return {
		canonicalSplitPathInsideLibraryToLocator: (sp) =>
			canonicalSplitPathInsideLibraryToLocator(
				_segmentId,
				_canonicalSplitPath,
				sp,
			),
		locatorToCanonicalSplitPathInsideLibrary: (loc) =>
			locatorToCanonicalSplitPathInsideLibrary(
				_segmentId,
				_canonicalSplitPath,
				_suffix,
				loc,
			),
	};
}
