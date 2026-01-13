/**
 * Compute the canonical split path for a section's codex file.
 */

import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs, SplitPathToMdFileInsideLibrary } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import { sectionChainToPathParts } from "../utils/section-chain-utils";
import { CODEX_CORE_NAME } from "./literals";

/**
 * Compute codex split path from section chain.
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
	if (sectionChain.length === 0) {
		throw new Error("Section chain cannot be empty");
	}

	// Extract node names from segment IDs using codec API
	const pathPartsResult = sectionChainToPathParts(
		sectionChain,
		codecs.segmentId,
	);
	if (pathPartsResult.isErr()) {
		throw new Error(
			`Failed to parse segment IDs. Should never happen with valid tree state: ${pathPartsResult.error.message}`,
		);
	}
	const pathParts = pathPartsResult.value;
	const nodeNames = pathParts;

	// suffixParts:
	// - Root codex (chain length 1): include Library name → ["Library"]
	// - Nested codex: exclude Library root, reversed → ["B", "A"] for ["Library", "A", "B"]
	const suffixParts =
		nodeNames.length === 1
			? nodeNames // Root: ["Library"]
			: nodeNames.slice(1).reverse(); // Nested: exclude root, reverse

	const basename = codecs.suffix.serializeSeparatedSuffix({
		coreName: CODEX_CORE_NAME,
		suffixParts,
	});

	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}
