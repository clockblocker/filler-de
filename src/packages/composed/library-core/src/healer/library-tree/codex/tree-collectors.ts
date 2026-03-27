/**
 * Tree traversal utilities for collecting node chains and scroll info.
 * Used by codex impact processing to find descendants.
 */

import type { Codecs } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import type { TreeReader } from "../tree-interfaces";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";

// ─── Types ───

export type ScrollInfo = {
	nodeName: string;
	parentChain: SectionNodeSegmentId[];
};

export type TreeTraversalResult = {
	sectionChains: SectionNodeSegmentId[][];
	scrollInfos: ScrollInfo[];
};

// ─── Descendant Collection ───

/**
 * Collect all descendant section chains from a section node.
 * Returns chains for all nested sections (not including the parent itself).
 *
 * @param section - The section to traverse
 * @param parentChain - Chain to the parent section
 */
export function collectDescendantSectionChains(
	section: SectionNode,
	parentChain: SectionNodeSegmentId[],
): SectionNodeSegmentId[][] {
	const result: SectionNodeSegmentId[][] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.kind === TreeNodeKind.Section) {
			const childChain = [...parentChain, segId as SectionNodeSegmentId];
			result.push(childChain);
			result.push(...collectDescendantSectionChains(child, childChain));
		}
	}

	return result;
}

/**
 * Collect all descendant scrolls from a section node.
 * Returns scroll info for all nested scrolls.
 *
 * @param section - The section to traverse
 * @param parentChain - Chain to the parent section
 */
export function collectDescendantScrolls(
	section: SectionNode,
	parentChain: SectionNodeSegmentId[],
): ScrollInfo[] {
	const result: ScrollInfo[] = [];

	for (const [segId, child] of Object.entries(section.children)) {
		if (child.kind === TreeNodeKind.Scroll) {
			result.push({
				nodeName: child.nodeName,
				parentChain,
			});
		} else if (child.kind === TreeNodeKind.Section) {
			const childChain = [...parentChain, segId as SectionNodeSegmentId];
			result.push(...collectDescendantScrolls(child, childChain));
		}
	}

	return result;
}

// ─── Full Tree Traversal ───

/**
 * Single DFS traversal collecting both section chains and scroll infos.
 * More efficient than separate collectAllSectionChains + collectAllScrolls.
 *
 * @param tree - Tree reader for accessing root
 * @param codecs - Codec API for creating segment IDs
 */
export function collectTreeData(
	tree: TreeReader,
	codecs: Codecs,
): TreeTraversalResult {
	const sectionChains: SectionNodeSegmentId[][] = [];
	const scrollInfos: ScrollInfo[] = [];

	const root = tree.getRoot();
	const rootSegId = codecs.segmentId.serializeSegmentId({
		coreName: root.nodeName,
		targetKind: TreeNodeKind.Section,
	}) as SectionNodeSegmentId;

	// Add root chain
	sectionChains.push([rootSegId]);

	// Single recursive traversal collecting both
	const traverse = (
		section: SectionNode,
		parentChain: SectionNodeSegmentId[],
	): void => {
		for (const [segId, child] of Object.entries(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				const childChain = [
					...parentChain,
					segId as SectionNodeSegmentId,
				];
				sectionChains.push(childChain);
				traverse(child, childChain);
			} else if (child.kind === TreeNodeKind.Scroll) {
				scrollInfos.push({
					nodeName: child.nodeName,
					parentChain,
				});
			}
		}
	};

	traverse(root, [rootSegId]);
	return { scrollInfos, sectionChains };
}
