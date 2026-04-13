import type { SplitPathKind } from "@textfresser/vault-action-manager";
import type { Result } from "neverthrow";
import type { TreeNodeKind } from "../../healer/library-tree/tree-node/types/atoms";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
import type { SegmentIdCodecs } from "../segment-id";
import type {
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../split-path-with-separated-suffix";
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
	const canonicalSplitPathToLocator: LocatorCodecs["canonicalSplitPathInsideLibraryToLocator"] =
		(sp) => {
			switch (sp.kind) {
				case "File":
					return canonicalSplitPathInsideLibraryToLocator(
						_segmentId,
						sp as unknown as CanonicalSplitPathToFileInsideLibrary,
					) as never;
				case "MdFile":
					return canonicalSplitPathInsideLibraryToLocator(
						_segmentId,
						sp as unknown as CanonicalSplitPathToMdFileInsideLibrary,
					) as never;
				case "Folder":
					return canonicalSplitPathInsideLibraryToLocator(
						_segmentId,
						sp as unknown as CanonicalSplitPathToFolderInsideLibrary,
					) as never;
			}
		};

	return {
		canonicalSplitPathInsideLibraryToLocator: canonicalSplitPathToLocator,
		locatorToCanonicalSplitPathInsideLibrary: (loc) =>
			locatorToCanonicalSplitPathInsideLibrary(_segmentId, _suffix, loc),
	};
}
