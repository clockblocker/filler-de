import type {
	Codecs,
	FileNodeLocator,
	ScrollNodeLocator,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../codecs";
import type { SectionNodeSegmentId } from "../../codecs/segment-id";
import type { HealingAction } from "../../healer/library-tree/types/healing-action";
import {
	type FileNode,
	makeNodeSegmentId,
	type ScrollNode,
	TreeNodeKind,
} from "../../tree";
import { SplitPathKind } from "@textfresser/vault-action-manager/types/split-path";
import {
	computeLeafHealingForFile,
	computeLeafHealingForScroll,
} from "./compute-leaf-healing";

export type LeafMoveParams = {
	/** The leaf node after move */
	node: ScrollNode | FileNode;
	/** New parent chain (segment IDs) */
	newParentChain: SectionNodeSegmentId[];
	/** Observed split path from the action */
	observedSplitPath:
		| SplitPathToMdFileInsideLibrary
		| SplitPathToFileInsideLibrary;
	/** Codec API */
	codecs: Codecs;
};

/**
 * Compute healing for a leaf (Scroll or File) move.
 */
export function computeLeafMoveHealing(
	params: LeafMoveParams,
): HealingAction[] {
	const { node, newParentChain, observedSplitPath, codecs } = params;

	const newSegmentId = makeNodeSegmentId(node);

	if (node.kind === TreeNodeKind.Scroll) {
		const newLocator: ScrollNodeLocator = {
			segmentId: newSegmentId as ScrollNodeLocator["segmentId"],
			segmentIdChainToParent: newParentChain,
			targetKind: TreeNodeKind.Scroll,
		};
		// Type guard: observedSplitPath must be MdFile for Scroll
		if (observedSplitPath.kind === SplitPathKind.MdFile) {
			return computeLeafHealingForScroll(
				newLocator,
				observedSplitPath,
				codecs,
			);
		}
		return [];
	}

	// File
	const newLocator: FileNodeLocator = {
		segmentId: newSegmentId as FileNodeLocator["segmentId"],
		segmentIdChainToParent: newParentChain,
		targetKind: TreeNodeKind.File,
	};
	// Type guard: observedSplitPath must be File for File
	if (observedSplitPath.kind === SplitPathKind.File) {
		return computeLeafHealingForFile(newLocator, observedSplitPath, codecs);
	}

	return [];
}
