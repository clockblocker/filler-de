/**
 * Types for selection handler.
 */

import type { App } from "obsidian";
import type { BottomToolbar } from "../bottom-toolbar";
import type { SelectionToolbar } from "../selection-toolbar";

export type SelectionHandlerContext = {
	app: App;
	activeLeafId: string | null;
	bottomToolbars: Map<string, BottomToolbar>;
	selectionToolbars: Map<string, SelectionToolbar>;
};

export type SelectionHandlerResult = {
	newActiveLeafId: string | null;
};
