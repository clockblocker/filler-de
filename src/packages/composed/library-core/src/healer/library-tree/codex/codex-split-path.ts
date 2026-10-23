/**
 * Compute the canonical split path for a section's codex file.
 */

import { Result } from "effect";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import { buildCodexSplitPath } from "../../../path-finder";
import { PREFIX_OF_CODEX } from "./literals";

/**
 * Compute codex split path from section chain.
 *
 * Invariant: `sectionChain` starts with the Library root, so it is not empty,
 * and each of its segment IDs parses. Callers pass a chain of the Tree, which
 * holds only segment IDs that parse, or one they serialized from node names
 * the codecs accepted. A chain that breaks this is a bug, and this throws.
 *
 * @param sectionChain - Full chain including Library root, e.g. ["Library﹘Section﹘", "A﹘Section﹘"]
 * @param codecs - Codec API for parsing segment IDs
 * @returns Split path for codex file
 *
 * Examples:
 * - ["Library"] → { pathParts: ["Library"], basename: "__-Library" }
 * - ["Library", "A"] → { pathParts: ["Library", "A"], basename: "__-A" }
 * - ["Library", "A", "B"] → { pathParts: ["Library", "A", "B"], basename: "__-B-A" }
 */
export function computeCodexSplitPath(
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): SplitPathToMdFileInsideLibrary {
	const result = buildCodexSplitPath(sectionChain, PREFIX_OF_CODEX, codecs);

	if (Result.isFailure(result)) {
		throw new Error(
			`Failed to compute codex split path: ${result.failure.kind} - ${result.failure.reason}`,
		);
	}

	return result.success;
}
