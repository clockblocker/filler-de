/**
 * Compute aggregated status for a section from its descendants.
 */

import { TreeNodeKind, TreeNodeStatus } from "../tree-node/types/atoms";
import type { SectionNode, TreeNode } from "../tree-node/types/tree-node";

/**
 * Compute aggregated status for a section.
 * - All descendant scrolls Done → Done
 * - Otherwise → NotStarted
 * - Empty section → NotStarted
 */
export function computeSectionStatus(section: SectionNode): TreeNodeStatus {
	const children = Object.values(section.children);

	if (children.length === 0) {
		return TreeNodeStatus.NotStarted;
	}

	return allDescendantsDone(children)
		? TreeNodeStatus.Done
		: TreeNodeStatus.NotStarted;
}

function allDescendantsDone(nodes: TreeNode[]): boolean {
	for (const node of nodes) {
		if (node.kind === TreeNodeKind.Section) {
			const children = Object.values(node.children);
			if (children.length === 0) {
				// Empty section counts as not done
				return false;
			}
			if (!allDescendantsDone(children)) {
				return false;
			}
		} else if (node.kind === TreeNodeKind.Scroll) {
			// Only scrolls affect section completion status
			if (node.status !== TreeNodeStatus.Done) {
				return false;
			}
		}
		// Files are ignored - they don't have meaningful status
	}
	return true;
}
