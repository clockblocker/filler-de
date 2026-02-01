/**
 * Types for selection handler.
 */

import type { App } from "obsidian";
import type { BottomToolbar } from "../bottom-toolbar/types";
import type { SelectionToolbar } from "../selection-toolbar/types";

export type SelectionHandlerContext = {
	app: App;
	activeLeafId: string | null;
	bottomToolbars: Map<string, BottomToolbar>;
	selectionToolbars: Map<string, SelectionToolbar>;
};

export type SelectionHandlerResult = {
	newActiveLeafId: string | null;
};
