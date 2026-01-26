/**
 * Types for bottom toolbar.
 */

import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

/**
 * Bottom toolbar interface.
 */
export interface BottomToolbar {
	/** Show the toolbar for a specific file */
	show(filePath: SplitPathToMdFile): void;
	/** Hide the toolbar */
	hide(): void;
	/** Clean up the toolbar */
	destroy(): void;
	/** Get the currently displayed file path */
	getCurrentFilePath(): SplitPathToMdFile | null;
}

/**
 * Options for creating a bottom toolbar.
 */
export type CreateBottomToolbarOptions = {
	/** Container element to attach the toolbar to */
	container: HTMLElement;
};
