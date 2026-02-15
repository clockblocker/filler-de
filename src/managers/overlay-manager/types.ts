/**
 * Shared types for overlay-manager.
 */

import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";

/**
 * Toolbar button configuration.
 */
export type ToolbarButton = {
	/** Action ID used in data-action attribute */
	actionId: string;
	/** Display label for the button */
	label: string;
};

/**
 * Configuration for the bottom toolbar.
 */
export type BottomToolbarConfig = {
	/** Buttons to display in the toolbar */
	buttons: ToolbarButton[];
};

/**
 * State for the overlay manager.
 */
export type OverlayState = {
	/** Currently displayed file path, or null if toolbar is hidden */
	currentFilePath: SplitPathToMdFile | null;
};
