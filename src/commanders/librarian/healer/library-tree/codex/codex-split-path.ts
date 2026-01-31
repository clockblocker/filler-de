/**
 * Compute the canonical split path for a section's codex file.
 *
 * NOTE: This file is a thin wrapper around PathFinder.buildCodexSplitPath
 * for backward compatibility. New code should import from paths/path-finder directly.
 */

import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import { buildCodexSplitPath } from "../../../paths/path-finder";
import { PREFIX_OF_CODEX } from "./literals";

/**
 * Compute codex split path from section chain.
 * Throws on error for backward compatibility.
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

	if (result.isErr()) {
		throw new Error(
			`Failed to compute codex split path: ${result.error.kind} - ${result.error.reason}`,
		);
	}

	return result.value;
}
