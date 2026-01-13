import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
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
): Result<
	CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>,
	CodecError
>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	suffix: SuffixCodecs,
	loc: TreeNodeLocator,
): Result<AnyCanonicalSplitPathInsideLibrary, CodecError> {
	// Both segmentIdChainToParent and pathParts INCLUDE Library root
	const pathPartsResult = loc.segmentIdChainToParent.reduce<
		Result<string[], CodecError>
	>((acc, segmentIdStr) => {
		if (acc.isErr()) return acc;
		return segmentId
			.parseSegmentId<typeof TreeNodeKind.Section>(segmentIdStr)
			.map((components) => {
				acc.value.push(components.coreName);
				return acc.value;
			});
	}, ok([]));

	if (pathPartsResult.isErr()) {
		return err(
			makeLocatorError(
				"InvalidSegmentId",
				"Failed to parse segment ID in chain",
				{ segmentIdChain: loc.segmentIdChainToParent },
				pathPartsResult.error,
			),
		);
	}
	const pathParts = pathPartsResult.value;

	// Parse segment ID components
	const segmentIdResult = segmentId.parseSegmentId(loc.segmentId);
	if (segmentIdResult.isErr()) {
		return err(
			makeLocatorError(
				"InvalidSegmentId",
				"Failed to parse locator segment ID",
				{ segmentId: loc.segmentId },
				segmentIdResult.error,
			),
		);
	}
	const { coreName, targetKind, extension } = segmentIdResult.value;

	// Build canonical separated suffixed basename
	// Use suffix codecs to build expected canonical format
	const pathPartsSansRoot = suffix.pathPartsWithRootToSuffixParts(pathParts);
	const suffixParts =
		targetKind === TreeNodeKind.Section ? [] : pathPartsSansRoot;

	// Build split path with separated suffix directly (assumes canonical I/O as invariant)
	const separatedSuffixedBasename = { coreName, suffixParts };
	let splitPathWithSeparatedSuffix: AnyCanonicalSplitPathInsideLibrary;

	if (targetKind === TreeNodeKind.Section) {
		splitPathWithSeparatedSuffix = {
			kind: SplitPathKind.Folder,
			pathParts,
			separatedSuffixedBasename,
		} as AnyCanonicalSplitPathInsideLibrary;
	} else if (targetKind === TreeNodeKind.Scroll) {
		splitPathWithSeparatedSuffix = {
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts,
			separatedSuffixedBasename,
		} as AnyCanonicalSplitPathInsideLibrary;
	} else {
		splitPathWithSeparatedSuffix = {
			extension: extension,
			kind: SplitPathKind.File,
			pathParts,
			separatedSuffixedBasename,
		} as AnyCanonicalSplitPathInsideLibrary;
	}

	// Return as CanonicalSplitPathInsideLibraryOf (type alias, structure is same)
	// No validation - locator codec assumes canonical input/output
	return ok(splitPathWithSeparatedSuffix);
}
