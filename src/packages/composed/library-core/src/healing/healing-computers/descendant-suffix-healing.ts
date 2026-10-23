import { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { Codecs } from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id";
import type { TreeActionError } from "../../healer/library-tree/tree-action/tree-action-error";
import type { HealingAction } from "../../healer/library-tree/types/healing-action";
import { type SectionNode, TreeNodeKind } from "../../tree";
import { buildObservedLeafSplitPath } from "../../tree/utils";
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
 * @returns the healing actions, or the first descendant whose canonical split
 *          path could not be built
 */
export function computeDescendantSuffixHealing(
	sectionChain: SectionNodeSegmentId[],
	section: SectionNode,
	oldSuffixPathParts: string[],
	codecs: Codecs,
	currentPathParts: string[],
): Result.Result<HealingAction[], TreeActionError> {
	const actualCurrentPath = currentPathParts;

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
			if (Result.isFailure(childHealing)) return childHealing;
			healingActions.push(...childHealing.success);
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
						targetKind: TreeNodeKind.Scroll,
					};
					const leafHealing = computeLeafHealingForScroll(
						locator,
						observedSplitPath,
						codecs,
					);
					if (Result.isFailure(leafHealing)) return leafHealing;
					healingActions.push(...leafHealing.success);
				}
			} else {
				if (observedSplitPath.kind === SplitPathKind.File) {
					const locator = {
						segmentId: segId as Parameters<
							typeof computeLeafHealingForFile
						>[0]["segmentId"],
						segmentIdChainToParent: sectionChain,
						targetKind: TreeNodeKind.File,
					};
					const leafHealing = computeLeafHealingForFile(
						locator,
						observedSplitPath,
						codecs,
					);
					if (Result.isFailure(leafHealing)) return leafHealing;
					healingActions.push(...leafHealing.success);
				}
			}
		}
	}

	return Result.succeed(healingActions);
}
