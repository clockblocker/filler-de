import { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../codecs";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../../codecs/locator/types";
import type { SectionNodeSegmentId } from "../../codecs/segment-id/types/segment-id";
import { makeNodeSegmentId } from "../library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "../library-tree/tree-node/types/atoms";
import type {
	FileNode,
	ScrollNode,
} from "../library-tree/tree-node/types/tree-node";
import type { HealingAction } from "../library-tree/types/healing-action";
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
