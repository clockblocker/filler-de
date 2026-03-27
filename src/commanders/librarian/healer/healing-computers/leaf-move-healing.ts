import { SplitPathKind } from "@textfresser/vault-action-manager/types/split-path";
import type {
	Codecs,
	FileNodeLocator,
	ScrollNodeLocator,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "@textfresser/library-core/codecs";
import type { SectionNodeSegmentId } from "@textfresser/library-core/codecs/segment-id/types/segment-id";
import { makeNodeSegmentId } from "@textfresser/library-core/healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "@textfresser/library-core/tree";
import type {
	FileNode,
	ScrollNode,
} from "@textfresser/library-core/healer/library-tree/tree-node/types/tree-node";
import type { HealingAction } from "@textfresser/library-core/healing";
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
