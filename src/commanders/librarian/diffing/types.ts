import type { TextStatus } from "../../../types/common-interface/enums";
import type { TextDto, TreePath } from "../types";

/**
 * Snapshot of tree state for diffing.
 */
export type TreeSnapshot = {
	/** All texts in the tree with their page statuses */
	texts: TextDto[];
	/** All section paths (excluding root) */
	sectionPaths: TreePath[];
};

/**
 * A change in status for a specific path.
 */
export type StatusChange = {
	path: TreePath;
	oldStatus: TextStatus;
	newStatus: TextStatus;
};

/**
 * Diff between two tree snapshots.
 */
export type TreeDiff = {
	/** Texts that exist in 'after' but not in 'before' */
	addedTexts: TextDto[];
	/** Texts that exist in 'before' but not in 'after' */
	removedTexts: TextDto[];
	/** Sections that exist in 'after' but not in 'before' */
	addedSections: TreePath[];
	/** Sections that exist in 'before' but not in 'after' */
	removedSections: TreePath[];
	/** Status changes (paths where status changed) */
	statusChanges: StatusChange[];
};

/**
 * Empty diff (no changes).
 */
export const EMPTY_DIFF: TreeDiff = {
	addedSections: [],
	addedTexts: [],
	removedSections: [],
	removedTexts: [],
	statusChanges: [],
};

/**
 * Check if diff has any changes.
 */
export function isDiffEmpty(diff: TreeDiff): boolean {
	return (
		diff.addedTexts.length === 0 &&
		diff.removedTexts.length === 0 &&
		diff.addedSections.length === 0 &&
		diff.removedSections.length === 0 &&
		diff.statusChanges.length === 0
	);
}
