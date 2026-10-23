/**
 * Section chain utilities for the library tree.
 *
 * NOTE: For new code, prefer `@textfresser/library-core/path-finder.ts`
 * to keep section-chain/path logic centralized.
 *
 * @see PathFinder.parseSectionChainToNodeNames in `@textfresser/library-core/path-finder.ts`
 */
import { Result } from "effect";
import type { CodecError } from "../../../codecs/errors";
import type { SegmentIdCodecs } from "../../../codecs/segment-id";
import { parseSectionChainCoreNames } from "../../../codecs/segment-id/section-chain";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";

/**
 * Convert section chain (segment IDs) to path parts (node names).
 * Returns Result instead of throwing.
 */
export function sectionChainToPathParts(
	segmentIds: SectionNodeSegmentId[],
	segmentIdCodecs: SegmentIdCodecs,
): Result.Result<string[], CodecError> {
	return Result.mapError(
		parseSectionChainCoreNames(segmentIds, segmentIdCodecs),
		(failure) => failure.error,
	);
}
