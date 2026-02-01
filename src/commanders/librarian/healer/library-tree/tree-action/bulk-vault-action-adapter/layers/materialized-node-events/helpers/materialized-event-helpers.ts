/**
 * Materialized Event Helpers - SplitPathKind to TreeNodeKind mapping.
 */

import type { AnySplitPath } from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { TreeNodeKind } from "../../../../../tree-node/types/atoms";

/**
 * Maps SplitPathKind to the corresponding TreeNodeKind.
 * This is the single source of truth for this conversion.
 *
 * - File (non-md) → File
 * - MdFile → Scroll
 * - Folder → Section
 */
export const SPLIT_PATH_KIND_TO_TREE_NODE_KIND: Record<
	SplitPathKind,
	TreeNodeKind
> = {
	[SplitPathKind.File]: TreeNodeKind.File,
	[SplitPathKind.MdFile]: TreeNodeKind.Scroll,
	[SplitPathKind.Folder]: TreeNodeKind.Section,
};

/**
 * Get TreeNodeKind for leaf split paths only.
 * Returns null for folders.
 */
export function getLeafNodeKind(
	sp: AnySplitPath,
): typeof TreeNodeKind.File | typeof TreeNodeKind.Scroll | null {
	switch (sp.kind) {
		case SplitPathKind.File:
			return TreeNodeKind.File;
		case SplitPathKind.MdFile:
			return TreeNodeKind.Scroll;
		case SplitPathKind.Folder:
			return null;
	}
}
