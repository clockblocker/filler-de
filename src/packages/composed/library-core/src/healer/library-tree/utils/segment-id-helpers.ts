import { Result } from "effect";
import type { Codecs } from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type { ScrollNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";

/**
 * Extract node name from scroll segment ID using codec API.
 */
export function extractNodeNameFromScrollSegmentId(
	segmentId: ScrollNodeSegmentId,
	codecs: Codecs,
): Result.Result<string, CodecError> {
	return Result.map(
		codecs.segmentId.parseScrollSegmentId(segmentId),
		(parsed) => parsed.coreName,
	);
}
