import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CanonicalSplitPathCodecs } from "../../canonical-split-path";
import type {
	AnyCanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../canonical-split-path/types/canonical-split-path";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SegmentIdCodecs } from "../../segment-id";
import type { AnySplitPathInsideLibrary } from "../../split-path-inside-library";
import type { CorrespondingSplitPathKind } from "../../types/type-mappings";
import type { NodeLocatorOf, TreeNodeLocator } from "../types";

/**
 * Converts locator to canonical split path inside library.
 * Returns Result instead of throwing.
 */
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<"File">,
): Result<CanonicalSplitPathToFileInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<"Scroll">,
): Result<CanonicalSplitPathToMdFileInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<"Section">,
): Result<CanonicalSplitPathToFolderInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary<
	NK extends TreeNodeKind,
>(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<NK>,
): Result<
	CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>,
	CodecError
>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
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

	const basename = suffix.serializeSeparatedSuffix({ coreName, suffixParts });

	// Build split path inside library with proper type inference
	const splitPathInsideLibrary: AnySplitPathInsideLibrary =
		targetKind === TreeNodeKind.Section
			? {
					basename,
					kind: SplitPathKind.Folder,
					pathParts,
				}
			: targetKind === TreeNodeKind.Scroll
				? {
						basename,
						extension: MD,
						kind: SplitPathKind.MdFile,
						pathParts,
					}
				: {
						basename,
						extension: extension,
						kind: SplitPathKind.File,
						pathParts,
					};

	// Convert to canonical
	const canonicalResult =
		canonicalSplitPath.splitPathInsideLibraryToCanonical(
			splitPathInsideLibrary,
		);

	if (canonicalResult.isErr()) {
		return err(
			makeLocatorError(
				"InvalidChain",
				"Failed to convert split path to canonical",
				{ splitPath: splitPathInsideLibrary },
				canonicalResult.error,
			),
		);
	}

	return ok(canonicalResult.value);
}
