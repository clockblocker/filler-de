/**
 * Section chain utilities for the library tree.
 *
 * NOTE: For new code, prefer importing from `src/commanders/librarian-new/paths/path-computer.ts`
 * which consolidates all path computation logic. This file is kept for backward compatibility.
 *
 * @see PathComputer.parseSectionChainToNodeNames in `src/commanders/librarian-new/paths/path-computer.ts`
 */
import { err, ok, type Result } from "neverthrow";
import type { CodecError } from "../../../codecs/errors";
import type { SegmentIdCodecs } from "../../../codecs/segment-id";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";

/**
 * Convert section chain (segment IDs) to path parts (node names).
 * Returns Result instead of throwing.
 */
export function sectionChainToPathParts(
	segmentIds: SectionNodeSegmentId[],
	segmentIdCodecs: SegmentIdCodecs,
): Result<string[], CodecError> {
	const pathParts: string[] = [];
	for (const segId of segmentIds) {
		const parseResult = segmentIdCodecs.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			return err(parseResult.error);
		}
		pathParts.push(parseResult.value.coreName);
	}
	return ok(pathParts);
}
