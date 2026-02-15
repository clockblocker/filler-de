import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { makeNodeSegmentId } from "../../../healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
	SegmentIdCodecs,
} from "../../segment-id";
import type {
	AnyCanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../split-path-with-separated-suffix";
import type { NodeLocatorOf } from "../../types";
import type { CorrespondingTreeNodeKind } from "../../types/type-mappings";
import type { TreeNodeLocator } from "../types";

/**
 * Converts canonical split path inside library to locator.
 * Returns Result instead of throwing.
 */
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	sp: CanonicalSplitPathToFileInsideLibrary,
): Result<NodeLocatorOf<"File">, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): Result<NodeLocatorOf<"Scroll">, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	sp: CanonicalSplitPathToFolderInsideLibrary,
): Result<NodeLocatorOf<"Section">, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator<
	SK extends SplitPathKind,
>(
	segmentId: SegmentIdCodecs,
	sp: CanonicalSplitPathInsideLibraryOf<SK>,
): Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	sp: AnyCanonicalSplitPathInsideLibrary,
): Result<TreeNodeLocator, CodecError> {
	// Both pathParts and segmentIdChainToParent INCLUDE Library root
	const segmentIdChainToParent = sp.pathParts.map((nodeName) =>
		makeNodeSegmentId({
			children: {},
			kind: TreeNodeKind.Section,
			nodeName,
		}),
	);

	switch (sp.kind) {
		case SplitPathKind.File: {
			const segmentIdResult = segmentId.serializeSegmentIdUnchecked({
				coreName: sp.separatedSuffixedBasename.coreName,
				extension: sp.extension,
				targetKind: TreeNodeKind.File,
			});

			if (segmentIdResult.isErr()) {
				return err(
					makeLocatorError(
						"InvalidSegmentId",
						"Failed to serialize file segment ID",
						{ extension: sp.extension },
						segmentIdResult.error,
					),
				);
			}
			return ok({
				// Type assertion: serializeSegmentIdUnchecked returns TreeNodeSegmentId union,
				// but we know it's FileNodeSegmentId because targetKind is File
				segmentId: segmentIdResult.value as FileNodeSegmentId,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.File,
			});
		}

		case SplitPathKind.MdFile: {
			const segmentIdResult = segmentId.serializeSegmentIdUnchecked({
				coreName: sp.separatedSuffixedBasename.coreName,
				extension: MD,
				targetKind: TreeNodeKind.Scroll,
			});
			if (segmentIdResult.isErr()) {
				return err(
					makeLocatorError(
						"InvalidSegmentId",
						"Failed to serialize scroll segment ID",
						{},
						segmentIdResult.error,
					),
				);
			}
			return ok({
				// Type assertion: serializeSegmentIdUnchecked returns TreeNodeSegmentId union,
				// but we know it's ScrollNodeSegmentId because targetKind is Scroll
				segmentId: segmentIdResult.value as ScrollNodeSegmentId,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Scroll,
			});
		}

		case SplitPathKind.Folder: {
			const segmentIdResult = segmentId.serializeSegmentIdUnchecked({
				coreName: sp.separatedSuffixedBasename.coreName,
				targetKind: TreeNodeKind.Section,
			});
			if (segmentIdResult.isErr()) {
				return err(
					makeLocatorError(
						"InvalidSegmentId",
						"Failed to serialize section segment ID",
						{},
						segmentIdResult.error,
					),
				);
			}
			return ok({
				// Type assertion: serializeSegmentIdUnchecked returns TreeNodeSegmentId union,
				// but we know it's SectionNodeSegmentId because targetKind is Section
				segmentId: segmentIdResult.value as SectionNodeSegmentId,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Section,
			});
		}
	}
}
