import { Result as EffectResult } from "effect";
import { err, ok, type Result } from "neverthrow";
import type { Codecs } from "../../../codecs";
import type { CodecError } from "../../../codecs/errors";
import type { ScrollNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";

/**
 * Extract node name from scroll segment ID using codec API.
 */
export function extractNodeNameFromScrollSegmentId(
	segmentId: ScrollNodeSegmentId,
	codecs: Codecs,
): Result<string, CodecError> {
	const parseResult = codecs.segmentId.parseScrollSegmentId(segmentId);
	if (EffectResult.isFailure(parseResult)) {
		return err(parseResult.failure);
	}
	return ok(parseResult.success.coreName);
}
