/**
 * Handler for selection changed events.
 */

import type { SelectionChangedPayload } from "../../obsidian/user-event-interceptor";
import type { SelectionHandlerContext, SelectionHandlerResult } from "./types";

/**
 * Handle selection changed events - update toolbar visibility based on selection state.
 */
export function handleSelectionChanged(
	payload: SelectionChangedPayload,
	context: SelectionHandlerContext,
): SelectionHandlerResult {
	const { app, bottomToolbars, selectionToolbars } = context;

	// Get active leaf ID
	const activeLeaf = app.workspace.activeLeaf;
	// Obsidian leaf.id is not in public API, accessing via any
	const activeLeafId = (activeLeaf as any)?.id as string | undefined;
	const newActiveLeafId = activeLeafId ?? null;

	// Update ALL bottom toolbars: show button only on active leaf if there's a selection
	for (const [leafId, toolbar] of bottomToolbars) {
		const showButton = payload.hasSelection && leafId === activeLeafId;
		toolbar.updateSelectionContext(showButton);
	}

	// Handle selection toolbar
	if (payload.hasSelection && activeLeafId) {
		const selectionToolbar = selectionToolbars.get(activeLeafId);
		if (selectionToolbar) {
			// Get selection rect from window.getSelection()
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				selectionToolbar.show(rect);
			}
		}

		// Hide selection toolbars for other leaves
		for (const [leafId, toolbar] of selectionToolbars) {
			if (leafId !== activeLeafId) {
				toolbar.hide();
			}
		}
	} else {
		// No selection - hide all selection toolbars
		for (const toolbar of selectionToolbars.values()) {
			toolbar.hide();
		}
	}

	return { newActiveLeafId };
}
