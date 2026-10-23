import { Result } from "effect";
import type { CodecError, Codecs } from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id";
import { sectionChainToPathParts } from "../../tree/utils";

/**
 * Parse old section path from a section locator.
 * Combines parent chain parsing with the node's own segment ID.
 *
 * Used in Rename and Move healing to get the OLD path (before operation).
 *
 * @param segmentIdChainToParent - parent chain segment IDs
 * @param segmentId - the section's own segment ID
 * @param codecs - codec API
 * @returns Result with path parts array or error
 */
export function parseOldSectionPath(
	segmentIdChainToParent: SectionNodeSegmentId[],
	segmentId: SectionNodeSegmentId,
	codecs: Codecs,
): Result.Result<string[], CodecError> {
	// Parse parent chain to path parts
	const parentPathResult = sectionChainToPathParts(
		segmentIdChainToParent,
		codecs.segmentId,
	);
	if (Result.isFailure(parentPathResult)) {
		return Result.fail(parentPathResult.failure);
	}

	// Parse the section's own segment ID
	const nodeNameResult = codecs.segmentId.parseSectionSegmentId(segmentId);
	if (Result.isFailure(nodeNameResult)) {
		return Result.fail(nodeNameResult.failure);
	}

	// Combine: parent path + node name
	return Result.succeed([
		...parentPathResult.success,
		nodeNameResult.success.coreName,
	]);
}
