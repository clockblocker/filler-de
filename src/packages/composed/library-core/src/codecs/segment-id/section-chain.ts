import { Result } from "effect";
import type { NodeName } from "../../types/schemas/node-name";
import type { CodecError } from "../errors";
import type { SegmentIdCodecs } from "./make";
import type { SectionNodeSegmentId } from "./types/segment-id";

/** The first segment ID of a section chain that did not parse, and why. */
type SectionChainParseFailure = {
	readonly error: CodecError;
	readonly segmentId: SectionNodeSegmentId;
};

/**
 * The core names of a section chain's segment IDs, in chain order.
 * The first segment ID that does not parse stops the parse.
 */
export function parseSectionChainCoreNames(
	chain: readonly SectionNodeSegmentId[],
	segmentIdCodecs: SegmentIdCodecs,
): Result.Result<NodeName[], SectionChainParseFailure> {
	const coreNames: NodeName[] = [];
	for (const segmentId of chain) {
		const parsed = segmentIdCodecs.parseSectionSegmentId(segmentId);
		if (Result.isFailure(parsed)) {
			return Result.fail({ error: parsed.failure, segmentId });
		}
		coreNames.push(parsed.success.coreName);
	}
	return Result.succeed(coreNames);
}
