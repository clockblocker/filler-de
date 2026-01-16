import { ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type { ScrollNodeLocator } from "../../../codecs/locator/types";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../tree-node/types/atoms";

/**
 * Compute split path for a scroll given its node name and parent chain.
 * Uses locator API for type-safe conversion.
 */
export function computeScrollSplitPath(
	nodeName: string,
	parentChain: SectionNodeSegmentId[],
	codecs: Codecs,
): Result<SplitPathToMdFileInsideLibrary, CodecError> {
	// Build segmentIdChainToParent by parsing each segment ID
	const segmentIdChainToParent: SectionNodeSegmentId[] = [];
	for (const segId of parentChain) {
		const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			return parseResult;
		}
		// Keep original segment ID (already validated)
		segmentIdChainToParent.push(segId);
	}

	// Create ScrollNodeSegmentId
	const segmentIdResult = codecs.segmentId.serializeSegmentIdUnchecked({
		coreName: nodeName,
		extension: "md",
		targetKind: TreeNodeKind.Scroll,
	});
	if (segmentIdResult.isErr()) {
		return segmentIdResult;
	}

	// Construct ScrollNodeLocator
	const locator: ScrollNodeLocator = {
		segmentId: segmentIdResult.value as ScrollNodeSegmentId,
		segmentIdChainToParent,
		targetKind: TreeNodeKind.Scroll,
	};

	// Convert locator to canonical split path, then to split path
	const canonicalResult =
		codecs.locator.locatorToCanonicalSplitPathInsideLibrary(locator);

	// Chain: canonical -> split path
	return canonicalResult.andThen((canonical) => {
		// Convert canonical to split path
		const splitPath =
			codecs.splitPathWithSeparatedSuffix.fromSplitPathInsideLibraryWithSeparatedSuffix(
				canonical,
			);

		// Type assertion: ScrollNodeLocator only produces SplitPathToMdFileInsideLibrary
		// The codec chain preserves types, but TypeScript widens due to generic inference
		return ok(splitPath as SplitPathToMdFileInsideLibrary);
	});
}
