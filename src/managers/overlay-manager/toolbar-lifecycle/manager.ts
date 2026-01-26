/**
 * Manager for toolbar lifecycle - create, update, and destroy toolbars.
 */

import { buildSplitPath } from "./path-utils";
import type { ToolbarLifecycleContext, ToolbarUpdateConfig } from "./types";

/**
 * Update toolbar visibility - creates, updates, or destroys toolbars based on workspace state.
 */
export function updateToolbarVisibility(
	context: ToolbarLifecycleContext,
	config: ToolbarUpdateConfig,
): void {
	const {
		app,
		bottomToolbars,
		selectionToolbars,
		createBottomToolbar,
		createSelectionToolbar,
	} = context;
	const { bottomActions, selectionActions } = config;

	const leaves = app.workspace.getLeavesOfType("markdown");
	const activeLeafIds = new Set<string>();

	for (const leaf of leaves) {
		const file = leaf.view?.file;
		if (!file || file.extension !== "md") continue;

		// Obsidian leaf.id is not in public API, accessing via any
		const leafId = (leaf as any).id as string | undefined;
		if (!leafId) continue;
		activeLeafIds.add(leafId);

		const container = leaf.view.containerEl?.querySelector(".view-content");
		if (!container || !(container instanceof HTMLElement)) continue;

		// Create bottom toolbar if not exists for this leaf
		if (!bottomToolbars.has(leafId)) {
			const toolbar = createBottomToolbar(container);
			toolbar.setActions(bottomActions);
			bottomToolbars.set(leafId, toolbar);
		} else {
			// Update actions for existing toolbar
			bottomToolbars.get(leafId)?.setActions(bottomActions);
		}

		// Create selection toolbar if not exists for this leaf
		if (!selectionToolbars.has(leafId)) {
			const toolbar = createSelectionToolbar(container);
			toolbar.setActions(selectionActions);
			selectionToolbars.set(leafId, toolbar);
		} else {
			// Update actions for existing toolbar
			selectionToolbars.get(leafId)?.setActions(selectionActions);
		}

		const filePath = buildSplitPath(file.path);
		if (filePath) {
			bottomToolbars.get(leafId)?.show(filePath);
		}
	}

	// Remove toolbars for closed leaves
	for (const [leafId, toolbar] of bottomToolbars) {
		if (!activeLeafIds.has(leafId)) {
			toolbar.destroy();
			bottomToolbars.delete(leafId);
		}
	}

	for (const [leafId, toolbar] of selectionToolbars) {
		if (!activeLeafIds.has(leafId)) {
			toolbar.destroy();
			selectionToolbars.delete(leafId);
		}
	}
}
