import type { TextStatus } from "../../../types/common-interface/enums";
import type { TextDto, TreePath } from "../types";
import {
	EMPTY_DIFF,
	type StatusChange,
	type TreeDiff,
	type TreeSnapshot,
} from "./types";

/**
 * Computes diff between two tree snapshots.
 */
export class TreeDiffer {
	/**
	 * Compute the difference between two snapshots.
	 */
	diff(before: TreeSnapshot, after: TreeSnapshot): TreeDiff {
		return {
			addedSections: this.findAddedSections(
				before.sectionPaths,
				after.sectionPaths,
			),
			addedTexts: this.findAddedTexts(before.texts, after.texts),
			removedSections: this.findRemovedSections(
				before.sectionPaths,
				after.sectionPaths,
			),
			removedTexts: this.findRemovedTexts(before.texts, after.texts),
			statusChanges: this.findStatusChanges(before.texts, after.texts),
		};
	}

	/**
	 * Texts in 'after' that don't exist in 'before'.
	 */
	private findAddedTexts(before: TextDto[], after: TextDto[]): TextDto[] {
		const beforeKeys = new Set(before.map((t) => this.textKey(t)));
		return after.filter((t) => !beforeKeys.has(this.textKey(t)));
	}

	/**
	 * Texts in 'before' that don't exist in 'after'.
	 */
	private findRemovedTexts(before: TextDto[], after: TextDto[]): TextDto[] {
		const afterKeys = new Set(after.map((t) => this.textKey(t)));
		return before.filter((t) => !afterKeys.has(this.textKey(t)));
	}

	/**
	 * Sections in 'after' that don't exist in 'before'.
	 */
	private findAddedSections(
		before: TreePath[],
		after: TreePath[],
	): TreePath[] {
		const beforeKeys = new Set(before.map((p) => this.pathKey(p)));
		return after.filter((p) => !beforeKeys.has(this.pathKey(p)));
	}

	/**
	 * Sections in 'before' that don't exist in 'after'.
	 */
	private findRemovedSections(
		before: TreePath[],
		after: TreePath[],
	): TreePath[] {
		const afterKeys = new Set(after.map((p) => this.pathKey(p)));
		return before.filter((p) => !afterKeys.has(this.pathKey(p)));
	}

	/**
	 * Find status changes between matching texts.
	 * Returns changes for both text-level and page-level status changes.
	 */
	private findStatusChanges(
		before: TextDto[],
		after: TextDto[],
	): StatusChange[] {
		const changes: StatusChange[] = [];
		const beforeMap = new Map(before.map((t) => [this.textKey(t), t]));
		const afterMap = new Map(after.map((t) => [this.textKey(t), t]));

		// Find texts that exist in both and check for status changes
		for (const [key, afterText] of afterMap) {
			const beforeText = beforeMap.get(key);
			if (!beforeText) continue;

			// Check each page for status changes
			const allPageNames = new Set([
				...Object.keys(beforeText.pageStatuses),
				...Object.keys(afterText.pageStatuses),
			]);

			for (const pageName of allPageNames) {
				const oldStatus = beforeText.pageStatuses[pageName];
				const newStatus = afterText.pageStatuses[pageName];

				// Page added or removed counts as status change too
				if (oldStatus !== newStatus) {
					const pagePath = [...afterText.path, pageName];
					changes.push({
						newStatus: newStatus ?? ("NotStarted" as TextStatus),
						oldStatus: oldStatus ?? ("NotStarted" as TextStatus),
						path: pagePath,
					});
				}
			}
		}

		return changes;
	}

	/**
	 * Get unique key for a text (by path).
	 */
	private textKey(text: TextDto): string {
		return text.path.join("/");
	}

	/**
	 * Get unique key for a path.
	 */
	private pathKey(path: TreePath): string {
		return path.join("/");
	}
}

/**
 * Singleton instance for convenience.
 */
export const treeDiffer = new TreeDiffer();
