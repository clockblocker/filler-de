import { err, ok, type Result } from "neverthrow";
import type { Codecs } from "../../codecs";
import type { CodecError } from "../../codecs/errors";
import type { SectionNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import { sectionChainToPathParts } from "../library-tree/utils/section-chain-utils";

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
): Result<string[], CodecError> {
	// Parse parent chain to path parts
	const parentPathResult = sectionChainToPathParts(
		segmentIdChainToParent,
		codecs.segmentId,
	);
	if (parentPathResult.isErr()) {
		return err(parentPathResult.error);
	}

	// Parse the section's own segment ID
	const nodeNameResult = codecs.segmentId.parseSectionSegmentId(segmentId);
	if (nodeNameResult.isErr()) {
		return err(nodeNameResult.error);
	}

	// Combine: parent path + node name
	return ok([...parentPathResult.value, nodeNameResult.value.coreName]);
}
