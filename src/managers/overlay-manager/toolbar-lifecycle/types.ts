/**
 * Types for toolbar lifecycle management.
 */

import type { App } from "obsidian";
import type { ActionConfig, BottomToolbar } from "../bottom-toolbar";
import type { EdgeZones } from "../edge-zones";
import type { SelectionToolbar } from "../selection-toolbar";

export type ToolbarLifecycleContext = {
	app: App;
	bottomToolbars: Map<string, BottomToolbar>;
	selectionToolbars: Map<string, SelectionToolbar>;
	edgeZones: Map<string, EdgeZones>;
	createBottomToolbar: (container: HTMLElement) => BottomToolbar;
	createSelectionToolbar: (container: HTMLElement) => SelectionToolbar;
	createEdgeZones: (container: HTMLElement) => EdgeZones;
};

export type ToolbarUpdateConfig = {
	bottomActions: ActionConfig[];
	selectionActions: ActionConfig[];
};
