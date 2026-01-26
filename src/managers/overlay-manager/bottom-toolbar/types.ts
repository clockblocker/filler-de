/**
 * Types for bottom toolbar.
 */

import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

/**
 * Action configuration for toolbar buttons.
 */
export type ActionConfig = {
	/** Action ID used in data-action attribute */
	id: string;
	/** Display label for the button */
	label: string;
	/** Whether button visibility depends on selection (default: true) */
	contextual?: boolean;
};

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
	/** Update visibility of selection-dependent buttons */
	updateSelectionContext(hasSelection: boolean): void;
	/** Set the actions to display */
	setActions(actions: ActionConfig[]): void;
}

/**
 * Options for creating a bottom toolbar.
 */
export type CreateBottomToolbarOptions = {
	/** Container element to attach the toolbar to */
	container: HTMLElement;
};
