import { MD, SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SegmentIdCodecs } from "../../segment-id";
import type {
	AnyCanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
} from "../../split-path-with-separated-suffix";
import type { CorrespondingSplitPathKind } from "../../types/type-mappings";
import type { NodeLocatorOf, TreeNodeLocator } from "../types";

/**
 * Converts locator to canonical split path inside library.
 * Returns Result instead of throwing.
 */
export function locatorToCanonicalSplitPathInsideLibrary<
	NK extends TreeNodeKind,
>(
	segmentId: SegmentIdCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<NK>,
): Result.Result<
	CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>,
	CodecError
>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	suffix: SuffixCodecs,
	loc: TreeNodeLocator,
): Result.Result<AnyCanonicalSplitPathInsideLibrary, CodecError> {
	// Both segmentIdChainToParent and pathParts INCLUDE Library root
	const pathParts: string[] = [];
	for (const segId of loc.segmentIdChainToParent) {
		const sectionResult = segmentId.parseSectionSegmentId(segId);
		if (Result.isFailure(sectionResult)) {
			return Result.fail(
				makeLocatorError(
					"InvalidSegmentId",
					"Failed to parse segment ID in chain",
					{ segmentIdChain: loc.segmentIdChainToParent },
					sectionResult.failure,
				),
			);
		}
		pathParts.push(sectionResult.success.coreName);
	}

	// Parse segment ID components
	const segmentIdResult = segmentId.parseSegmentId(loc.segmentId);
	if (Result.isFailure(segmentIdResult)) {
		return Result.fail(
			makeLocatorError(
				"InvalidSegmentId",
				"Failed to parse locator segment ID",
				{ segmentId: loc.segmentId },
				segmentIdResult.failure,
			),
		);
	}
	const segmentIdComponents = segmentIdResult.success;

	// Build canonical separated suffixed basename
	// Use suffix codecs to build expected canonical format
	const pathPartsSansRoot = suffix.pathPartsWithRootToSuffixParts(pathParts);

	// Build split path with separated suffix directly (assumes canonical I/O as invariant)
	switch (segmentIdComponents.targetKind) {
		case TreeNodeKind.Section:
			return Result.succeed({
				kind: SplitPathKind.Folder,
				pathParts,
				separatedSuffixedBasename: {
					coreName: segmentIdComponents.coreName,
					suffixParts: [],
				},
			});
		case TreeNodeKind.Scroll:
			return Result.succeed({
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts,
				separatedSuffixedBasename: {
					coreName: segmentIdComponents.coreName,
					suffixParts: pathPartsSansRoot,
				},
			});
		case TreeNodeKind.File:
			return Result.succeed({
				extension: segmentIdComponents.extension,
				kind: SplitPathKind.File,
				pathParts,
				separatedSuffixedBasename: {
					coreName: segmentIdComponents.coreName,
					suffixParts: pathPartsSansRoot,
				},
			});
	}
}
