import { err, ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../../../healer/library-tree/tree-action/types/target-chains";
import type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../healer/library-tree/tree-action/utils/canonical-naming/types";
import { makeNodeSegmentId } from "../../../healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type { FileExtension } from "../../../healer/library-tree/tree-node/types/atoms";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CanonicalSplitPathCodecs } from "../../canonical-split-path";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type { SegmentIdCodecs } from "../../segment-id";

/**
 * Converts canonical split path inside library to locator.
 * Returns Result instead of throwing.
 */
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	sp: CanonicalSplitPathToFileInsideLibrary,
): Result<FileNodeLocator, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	sp: CanonicalSplitPathToMdFileInsideLibrary,
): Result<ScrollNodeLocator, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	sp: CanonicalSplitPathToFolderInsideLibrary,
): Result<SectionNodeLocator, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	sp: CanonicalSplitPathInsideLibrary,
): Result<TreeNodeLocator, CodecError>;
export function canonicalSplitPathInsideLibraryToLocator(
	segmentId: SegmentIdCodecs,
	_canonicalSplitPath: CanonicalSplitPathCodecs,
	sp: CanonicalSplitPathInsideLibrary,
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
				segmentId: segmentIdResult.value,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.File,
			} satisfies FileNodeLocator);
		}

		case SplitPathKind.MdFile: {
			const segmentIdResult = segmentId.serializeSegmentIdUnchecked({
				coreName: sp.separatedSuffixedBasename.coreName,
				extension: "md",
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
				segmentId: segmentIdResult.value,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Scroll,
			} satisfies ScrollNodeLocator);
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
				segmentId: segmentIdResult.value,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Section,
			} satisfies SectionNodeLocator);
		}
	}
}
