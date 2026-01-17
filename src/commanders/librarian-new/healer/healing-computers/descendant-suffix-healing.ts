import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs } from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../library-tree/tree-node/types/atoms";
import type { SectionNode } from "../library-tree/tree-node/types/tree-node";
import type { HealingAction } from "../library-tree/types/healing-action";
import { sectionChainToPathParts } from "../library-tree/utils/section-chain-utils";
import { buildObservedLeafSplitPath } from "../library-tree/utils/split-path-utils";
import {
	computeLeafHealingForFile,
	computeLeafHealingForScroll,
} from "./compute-leaf-healing";

/**
 * Compute healing for all descendants after section rename/move.
 * Pure function - no class dependencies.
 *
 * @param sectionChain - NEW chain to the section (where it IS now in tree)
 * @param section - the section node
 * @param oldSuffixPathParts - OLD path parts (for computing old basename suffix)
 * @param codecs - Codec API
 * @param currentPathParts - NEW path parts (where files ARE now in filesystem)
 *                           If undefined, derived from sectionChain.
 */
export function computeDescendantSuffixHealing(
	sectionChain: SectionNodeSegmentId[],
	section: SectionNode,
	oldSuffixPathParts: string[],
	codecs: Codecs,
	currentPathParts?: string[],
): HealingAction[] {
	// Derive current path from sectionChain if not provided
	const actualCurrentPath =
		currentPathParts ??
		(() => {
			const pathResult = sectionChainToPathParts(
				sectionChain,
				codecs.segmentId,
			);
			if (pathResult.isErr()) {
				throw new Error(
					`Failed to parse section chain: ${pathResult.error.message}`,
				);
			}
			return pathResult.value;
		})();

	const healingActions: HealingAction[] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.kind === TreeNodeKind.Section) {
			// Recurse with extended paths
			const childOldSuffixPath = [...oldSuffixPathParts, child.nodeName];
			const childCurrentPath = [...actualCurrentPath, child.nodeName];
			const childHealing = computeDescendantSuffixHealing(
				[...sectionChain, segId as SectionNodeSegmentId],
				child,
				childOldSuffixPath,
				codecs,
				childCurrentPath,
			);
			healingActions.push(...childHealing);
		} else {
			// Leaf: derive observed path from parent + leaf basename
			// Build observed split path for this leaf
			// - basename uses OLD suffix (what the file WAS named)
			// - pathParts uses CURRENT path (where the file IS now)
			const observedSplitPath = buildObservedLeafSplitPath(
				child,
				oldSuffixPathParts,
				actualCurrentPath,
				codecs,
			);

			// Narrow types based on child kind
			if (child.kind === TreeNodeKind.Scroll) {
				if (observedSplitPath.kind === SplitPathKind.MdFile) {
					const locator = {
						segmentId: segId as Parameters<
							typeof computeLeafHealingForScroll
						>[0]["segmentId"],
						segmentIdChainToParent: sectionChain,
						targetKind: TreeNodeKind.Scroll as const,
					};
					const leafHealing = computeLeafHealingForScroll(
						locator,
						observedSplitPath,
						codecs,
					);
					healingActions.push(...leafHealing);
				}
			} else {
				if (observedSplitPath.kind === SplitPathKind.File) {
					const locator = {
						segmentId: segId as Parameters<
							typeof computeLeafHealingForFile
						>[0]["segmentId"],
						segmentIdChainToParent: sectionChain,
						targetKind: TreeNodeKind.File as const,
					};
					const leafHealing = computeLeafHealingForFile(
						locator,
						observedSplitPath,
						codecs,
					);
					healingActions.push(...leafHealing);
				}
			}
		}
	}

	return healingActions;
}
