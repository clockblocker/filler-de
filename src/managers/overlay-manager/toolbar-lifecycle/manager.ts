/**
 * Manager for toolbar lifecycle - create, update, and destroy toolbars.
 */

import { MarkdownView } from "obsidian";
import { computeNavActions } from "../action-definitions/placement-utils";
import type { ActionConfig } from "../bottom-toolbar/types";
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
		librarian,
		bottomToolbars,
		selectionToolbars,
		edgeZones,
		createBottomToolbar,
		createSelectionToolbar,
		createEdgeZones,
	} = context;
	const { bottomActions, selectionActions } = config;

	const leaves = app.workspace.getLeavesOfType("markdown");
	const activeLeafIds = new Set<string>();

	for (const leaf of leaves) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) continue;
		const file = view.file;
		if (!file || file.extension !== "md") continue;

		// Skip codex files - no toolbars for them
		if (file.basename.startsWith("__")) continue;

		// Obsidian leaf.id is not in public API, accessing via any
		const leafId = (leaf as any).id as string | undefined;
		if (!leafId) continue;
		activeLeafIds.add(leafId);

		const container = view.containerEl?.querySelector(".view-content");
		if (!container || !(container instanceof HTMLElement)) continue;

		const filePath = buildSplitPath(file.path);
		const navActions = filePath
			? computeNavActions(librarian, filePath)
			: [];

		// Combine base bottom actions with nav actions
		const allBottomActions: ActionConfig[] = [
			...bottomActions,
			...navActions,
		];

		// Create bottom toolbar if not exists for this leaf
		if (!bottomToolbars.has(leafId)) {
			const toolbar = createBottomToolbar(container);
			toolbar.setActions(allBottomActions);
			bottomToolbars.set(leafId, toolbar);
		} else {
			// Update actions for existing toolbar
			bottomToolbars.get(leafId)?.setActions(allBottomActions);
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

		// Create/update edge zones
		if (!edgeZones.has(leafId)) {
			const zones = createEdgeZones(container);
			zones.attach(container, view);
			zones.setNavActions(navActions);
			edgeZones.set(leafId, zones);
		} else {
			edgeZones.get(leafId)?.setNavActions(navActions);
		}

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

	// Remove edge zones for closed leaves
	for (const [leafId, zones] of edgeZones) {
		if (!activeLeafIds.has(leafId)) {
			zones.destroy();
			edgeZones.delete(leafId);
		}
	}
}
