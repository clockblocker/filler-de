/**
 * Compute the canonical split path for a section's codex file.
 */

import { SplitPathType } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SplitPathToMdFileInsideLibrary } from "../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import { makeJoinedSuffixedBasename } from "../tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "../tree-node/types/node-segment-id";
import { CODEX_CORE_NAME } from "./literals";

/**
 * Compute codex split path from section chain.
 *
 * @param sectionChain - Full chain including Library root, e.g. ["Library﹘Section﹘", "A﹘Section﹘"]
 * @returns Split path for codex file, e.g. { pathParts: ["Library", "A"], basename: "__-A", extension: "md" }
 */
export function computeCodexSplitPath(
	sectionChain: SectionNodeSegmentId[],
): SplitPathToMdFileInsideLibrary {
	if (sectionChain.length === 0) {
		throw new Error("Section chain cannot be empty");
	}

	// Extract node names from segment IDs
	const nodeNames = sectionChain.map(extractNodeNameFromSegmentId);

	// pathParts = all node names (Library root + sections)
	const pathParts = nodeNames;

	// suffixParts = all except Library root, reversed
	// For ["Library", "A", "B"] → suffixParts = ["B", "A"]
	const suffixParts = nodeNames.slice(1).reverse();

	const basename = makeJoinedSuffixedBasename({
		coreName: CODEX_CORE_NAME,
		suffixParts,
	});

	return {
		basename,
		extension: "md",
		pathParts,
		type: SplitPathType.MdFile,
	};
}

function extractNodeNameFromSegmentId(segId: SectionNodeSegmentId): string {
	const sep = NodeSegmentIdSeparator;
	const [raw] = segId.split(sep, 1);
	return raw ?? "";
}
