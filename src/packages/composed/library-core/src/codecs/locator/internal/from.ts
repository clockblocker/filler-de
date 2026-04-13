import { MD } from "@textfresser/vault-action-manager";
import { SplitPathKind } from "@textfresser/vault-action-manager";
import { err, ok, type Result } from "neverthrow";
import { makeNodeSegmentId } from "../../../healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "../../../healer/library-tree/tree-node/types/atoms";
import type { CodecError } from "../../errors";
import { makeLocatorError } from "../../errors";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
	SectionNodeSegmentIdChain,
	SegmentIdCodecs,
} from "../../segment-id";
import type {
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../split-path-with-separated-suffix";
import type { NodeLocatorOf } from "../../types";
import type { CorrespondingTreeNodeKind } from "../../types/type-mappings";

type SegmentIdForKind = {
	[TreeNodeKind.File]: FileNodeSegmentId;
	[TreeNodeKind.Scroll]: ScrollNodeSegmentId;
	[TreeNodeKind.Section]: SectionNodeSegmentId;
};

function serializeAndBuildLocator<NK extends TreeNodeKind>(
	segmentId: SegmentIdCodecs,
	components: { coreName: string; targetKind: NK; extension?: string },
	segmentIdChainToParent: SectionNodeSegmentIdChain,
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
): Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError> {
	// Both pathParts and segmentIdChainToParent INCLUDE Library root
	const segmentIdChainToParent: SectionNodeSegmentIdChain = sp.pathParts.map(
		(nodeName) =>
			makeNodeSegmentId({
				children: {},
				kind: TreeNodeKind.Section,
				// pathParts are section names by codec invariant
				nodeName: nodeName as (typeof sp.pathParts)[number],
			}) as SectionNodeSegmentId,
	);

	switch (sp.kind) {
		case SplitPathKind.File:
			{
				const filePath =
					sp as unknown as CanonicalSplitPathToFileInsideLibrary;
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: filePath.separatedSuffixedBasename.coreName,
					extension: filePath.extension,
					targetKind: TreeNodeKind.File,
				},
				segmentIdChainToParent,
				{ extension: filePath.extension },
			) as Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
			}

		case SplitPathKind.MdFile:
			{
				const mdPath =
					sp as unknown as CanonicalSplitPathToMdFileInsideLibrary;
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: mdPath.separatedSuffixedBasename.coreName,
					extension: MD,
					targetKind: TreeNodeKind.Scroll,
				},
				segmentIdChainToParent,
				{},
			) as Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
			}

		case SplitPathKind.Folder:
			{
				const folderPath = sp as CanonicalSplitPathToFolderInsideLibrary;
			return serializeAndBuildLocator(
				segmentId,
				{
					coreName: folderPath.separatedSuffixedBasename.coreName,
					targetKind: TreeNodeKind.Section,
				},
				segmentIdChainToParent,
				{},
			) as Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
			}
	}
}
