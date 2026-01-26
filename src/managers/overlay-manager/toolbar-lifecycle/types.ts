/**
 * Types for toolbar lifecycle management.
 */

import type { App } from "obsidian";
import type { ActionConfig, BottomToolbar } from "../bottom-toolbar";
import type { SelectionToolbar } from "../selection-toolbar";

export type ToolbarLifecycleContext = {
	app: App;
	bottomToolbars: Map<string, BottomToolbar>;
	selectionToolbars: Map<string, SelectionToolbar>;
	createBottomToolbar: (container: HTMLElement) => BottomToolbar;
	createSelectionToolbar: (container: HTMLElement) => SelectionToolbar;
};

export type ToolbarUpdateConfig = {
	bottomActions: ActionConfig[];
	selectionActions: ActionConfig[];
};
