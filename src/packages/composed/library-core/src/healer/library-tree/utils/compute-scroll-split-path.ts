import { MD } from "@textfresser/vault-action-manager";
import { Result } from "effect";
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
): Result.Result<SplitPathToMdFileInsideLibrary, CodecError> {
	// Build segmentIdChainToParent by parsing each segment ID
	const segmentIdChainToParent: SectionNodeSegmentId[] = [];
	for (const segId of parentChain) {
		const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
		if (Result.isFailure(parseResult)) {
			return Result.fail(parseResult.failure);
		}
		// Keep original segment ID (already validated)
		segmentIdChainToParent.push(segId);
	}

	// Create ScrollNodeSegmentId
	const segmentIdResult = codecs.segmentId.serializeSegmentIdUnchecked({
		coreName: nodeName,
		extension: MD,
		targetKind: TreeNodeKind.Scroll,
	});
	if (Result.isFailure(segmentIdResult)) {
		return Result.fail(segmentIdResult.failure);
	}

	// Construct ScrollNodeLocator
	const locator: ScrollNodeLocator = {
		segmentId: segmentIdResult.success as ScrollNodeSegmentId,
		segmentIdChainToParent,
		targetKind: TreeNodeKind.Scroll,
	};

	// Convert locator to canonical split path, then to split path
	const canonicalResult =
		codecs.locator.locatorToCanonicalSplitPathInsideLibrary(locator);

	if (Result.isFailure(canonicalResult)) {
		return Result.fail(canonicalResult.failure);
	}

	// Convert canonical to split path
	const splitPath =
		codecs.splitPathWithSeparatedSuffix.fromSplitPathInsideLibraryWithSeparatedSuffix(
			canonicalResult.success,
		);

	// Type assertion: ScrollNodeLocator only produces SplitPathToMdFileInsideLibrary
	// The codec chain preserves types, but TypeScript widens due to generic inference
	return Result.succeed(splitPath as SplitPathToMdFileInsideLibrary);
}
