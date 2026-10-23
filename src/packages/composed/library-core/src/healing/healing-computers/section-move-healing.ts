import { SplitPathKind, VaultPath } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { Codecs, SplitPathToFolderInsideLibrary } from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id";
import { TreeActionError } from "../../healer/library-tree/tree-action/tree-action-error";
import type { HealingAction } from "../../healer/library-tree/types/healing-action";
import { makeNodeSegmentId, type SectionNode } from "../../tree";
import { sectionChainToPathParts } from "../../tree/utils";
import { computeDescendantSuffixHealing } from "./descendant-suffix-healing";

type SectionMoveParams = {
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
 * Fails when the new parent chain or a descendant's locator does not parse.
 */
export function computeSectionMoveHealing(
	params: SectionMoveParams,
): Result.Result<HealingAction[], TreeActionError> {
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
	if (Result.isFailure(canonicalSectionPathResult)) {
		return Result.fail(
			new TreeActionError({
				message: `Failed to parse section chain: ${canonicalSectionPathResult.failure.message}`,
			}),
		);
	}
	const canonicalSectionPath = [
		...canonicalSectionPathResult.success,
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
	if (
		!VaultPath.caseSensitive.same(observedFolderPath, canonicalFolderPath)
	) {
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

	return Result.map(descendantHealing, (descendants) => [
		...healingActions,
		...descendants,
	]);
}
