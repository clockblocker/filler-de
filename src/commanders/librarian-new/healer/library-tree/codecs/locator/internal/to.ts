import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../../../tree-action/types/target-chains";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../tree-action/utils/canonical-naming/types";
import { makeNodeSegmentId } from "../../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type { FileExtension } from "../../../tree-node/types/atoms";
import { TreeNodeKind } from "../../../tree-node/types/atoms";
import type { CanonicalSplitPathCodecs } from "../../canonical-split-path";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SegmentIdCodecs } from "../../segment-id";

/**
 * Converts locator to canonical split path inside library.
 * Returns Result instead of throwing.
 */
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: FileNodeLocator,
): Result<CanonicalSplitPathToFileInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: ScrollNodeLocator,
): Result<CanonicalSplitPathToMdFileInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: SectionNodeLocator,
): Result<CanonicalSplitPathToFolderInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: TreeNodeLocator,
): Result<CanonicalSplitPathInsideLibrary, CodecError>;
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: TreeNodeLocator,
): Result<CanonicalSplitPathInsideLibrary, CodecError> {
	// Both segmentIdChainToParent and pathParts INCLUDE Library root
	const pathPartsResult = loc.segmentIdChainToParent.reduce<
		Result<string[], CodecError>
	>((acc, segmentIdStr) => {
		if (acc.isErr()) return acc;
		return segmentId
			.parseSegmentId<TreeNodeKind.Section>(segmentIdStr)
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

	// Build split path inside library first
	const splitPathInsideLibraryBase = {
		basename: suffix.serializeSeparatedSuffix({ coreName, suffixParts }),
		kind:
			targetKind === TreeNodeKind.Section
				? SplitPathKind.Folder
				: targetKind === TreeNodeKind.Scroll
					? SplitPathKind.MdFile
					: SplitPathKind.File,
		pathParts,
	} as const;

	const splitPathInsideLibrary =
		targetKind === TreeNodeKind.Section
			? splitPathInsideLibraryBase
			: {
					...splitPathInsideLibraryBase,
					extension:
						targetKind === TreeNodeKind.Scroll
							? (MD as const)
							: (extension as FileExtension),
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
