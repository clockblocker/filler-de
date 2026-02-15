import { err, ok, type Result } from "neverthrow";
import { MD } from "../../../../../managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { makeNodeSegmentId } from "../../../healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CodecError } from "../../errors";
import { makeLocatorError, makeZodError } from "../../errors";
import {
	FileNodeSegmentIdSchema,
	ScrollNodeSegmentIdSchema,
	SectionNodeSegmentIdSchema,
} from "../../segment-id";
import type {
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

type SegmentIdForKind = {
	[TreeNodeKind.File]: FileNodeSegmentId;
	[TreeNodeKind.Scroll]: ScrollNodeSegmentId;
	[TreeNodeKind.Section]: SectionNodeSegmentId;
};

function serializeAndBuildLocator<NK extends TreeNodeKind>(
	segmentId: SegmentIdCodecs,
	components: { coreName: string; targetKind: NK; extension?: string },
	segmentIdChainToParent: ReturnType<typeof makeNodeSegmentId>[],
	errorContext: Record<string, unknown>,
): Result<
	{
		segmentId: SegmentIdForKind[NK];
		segmentIdChainToParent: typeof segmentIdChainToParent;
		targetKind: NK;
	},
	CodecError
> {
	const segmentIdResult = segmentId.serializeSegmentIdUnchecked(components);

	if (segmentIdResult.isErr()) {
		return err(
			makeLocatorError(
				"InvalidSegmentId",
				`Failed to serialize ${components.targetKind.toLowerCase()} segment ID`,
				errorContext,
				segmentIdResult.error,
			),
		);
	}
	return ok({
		// Type assertion: serializeSegmentIdUnchecked returns TreeNodeSegmentId union,
		// but we know it matches NK because targetKind constrains the output
		segmentId: segmentIdResult.value as SegmentIdForKind[NK],
		segmentIdChainToParent,
		targetKind: components.targetKind,
	});
}

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
		case SplitPathKind.File:
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: sp.separatedSuffixedBasename.coreName,
					extension: sp.extension,
					targetKind: TreeNodeKind.File,
				},
				segmentIdChainToParent,
				{ extension: sp.extension },
			);

		case SplitPathKind.MdFile:
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: sp.separatedSuffixedBasename.coreName,
					extension: MD,
					targetKind: TreeNodeKind.Scroll,
				},
				segmentIdChainToParent,
				{},
			);

		case SplitPathKind.Folder:
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: sp.separatedSuffixedBasename.coreName,
					targetKind: TreeNodeKind.Section,
				},
				segmentIdChainToParent,
				{},
			);
	}
}
