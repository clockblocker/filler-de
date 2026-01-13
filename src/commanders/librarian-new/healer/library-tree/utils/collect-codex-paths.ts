import { systemPathFromSplitPathInternal } from "../../../../managers/obsidian/vault-action-manager/helpers/pathfinder";
import type { Codecs } from "../../../codecs";
import { computeCodexSplitPath } from "../codex/codex-split-path";
import { makeNodeSegmentId } from "../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";

/**
 * Recursively collect all valid codex paths from the tree.
 */
export function collectValidCodexPaths(
	section: SectionNode,
	parentChain: SectionNodeSegmentId[],
	paths: Set<string>,
	codecs: Codecs,
): void {
	// Current section's chain
	const currentSegmentId = makeNodeSegmentId(section);
	const currentChain = [...parentChain, currentSegmentId];

	// Compute codex path for this section
	const codexSplitPath = computeCodexSplitPath(currentChain, codecs);
	const codexPath = systemPathFromSplitPathInternal(codexSplitPath);
	paths.add(codexPath);

	// Recurse into child sections
	for (const child of Object.values(section.children)) {
		if (child.kind === TreeNodeKind.Section) {
			collectValidCodexPaths(child, currentChain, paths, codecs);
		}
	}
}
