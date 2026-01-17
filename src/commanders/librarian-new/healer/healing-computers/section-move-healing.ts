import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { Codecs, SplitPathToFolderInsideLibrary } from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import { makeNodeSegmentId } from "../library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type { SectionNode } from "../library-tree/tree-node/types/tree-node";
import type { HealingAction } from "../library-tree/types/healing-action";
import { sectionChainToPathParts } from "../library-tree/utils/section-chain-utils";
import { computeDescendantSuffixHealing } from "./descendant-suffix-healing";

export type SectionMoveParams = {
	/** The section node after move */
	section: SectionNode;
	/** New parent chain (segment IDs) */
	newParentChain: SectionNodeSegmentId[];
	/** New node name (might be renamed during move) */
	newNodeName: string;
	/** Old section path (before move) */
	oldSectionPath: string[];
	/** Observed split path from the action */
	observedSplitPath: SplitPathToFolderInsideLibrary;
	/** Codec API */
	codecs: Codecs;
};

/**
 * Compute healing for a section move.
 * Handles folder rename and descendant suffix healing.
 */
export function computeSectionMoveHealing(
	params: SectionMoveParams,
): HealingAction[] {
	const {
		section,
		newParentChain,
		newNodeName,
		oldSectionPath,
		observedSplitPath,
		codecs,
	} = params;

	// Compute new segment ID and chain in tree
	const newSegmentId = makeNodeSegmentId(section);
	const newSectionChain = [
		...newParentChain,
		newSegmentId as SectionNodeSegmentId,
	];

	// Canonical path: parent chain + new node name
	const canonicalSectionPathResult = sectionChainToPathParts(
		newParentChain,
		codecs.segmentId,
	);
	if (canonicalSectionPathResult.isErr()) {
		throw new Error(
			`Failed to parse section chain: ${canonicalSectionPathResult.error.message}`,
		);
	}
	const canonicalSectionPath = [
		...canonicalSectionPathResult.value,
		newNodeName,
	];

	// Current path in filesystem (from observed)
	const currentSectionPath = [
		...observedSplitPath.pathParts,
		observedSplitPath.basename,
	];

	const healingActions: HealingAction[] = [];

	// 1) Heal the folder itself if observed != canonical
	const observedFolderPath = currentSectionPath.join("/");
	const canonicalFolderPath = canonicalSectionPath.join("/");
	if (observedFolderPath !== canonicalFolderPath) {
		const renameFolderAction: HealingAction = {
			kind: "RenameFolder",
			payload: {
				from: {
					basename: observedSplitPath.basename,
					kind: SplitPathKind.Folder,
					pathParts: observedSplitPath.pathParts,
				},
				to: {
					basename: newNodeName,
					kind: SplitPathKind.Folder,
					pathParts: canonicalSectionPath.slice(0, -1),
				},
			},
		};
		healingActions.push(renameFolderAction);
	}

	// 2) Heal descendants (they will move with folder, but suffixes need update)
	// After folder heals, descendants are at canonicalSectionPath
	const descendantHealing = computeDescendantSuffixHealing(
		newSectionChain,
		section,
		oldSectionPath,
		codecs,
		canonicalSectionPath, // after folder heals, files are here
	);

	return [...healingActions, ...descendantHealing];
}
