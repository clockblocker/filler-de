/**
 * Manager for toolbar lifecycle - create, update, and destroy toolbars.
 */

import type { MarkdownView } from "obsidian";
import { z } from "zod";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import {
	computeNavActions,
	type PageNavMetadata,
} from "../action-definitions/placement-utils";
import type { ActionConfig } from "../bottom-toolbar/types";
import { buildSplitPath } from "./path-utils";
import type { ToolbarLifecycleContext, ToolbarUpdateConfig } from "./types";

/** Schema for reading page navigation metadata */
const PageNavMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
	})
	.passthrough();

/**
 * Read page metadata from editor content.
 */
function getPageMetadata(view: MarkdownView): PageNavMetadata | null {
	// Get editor content synchronously
	const editor = view.editor;
	if (!editor) return null;

	const content = editor.getValue();
	return noteMetadataHelper.read(content, PageNavMetadataSchema);
}

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
		edgeZones,
		createBottomToolbar,
		createSelectionToolbar,
		createEdgeZones,
	} = context;
	const { bottomActions, selectionActions } = config;

	const leaves = app.workspace.getLeavesOfType("markdown");
	const activeLeafIds = new Set<string>();

	for (const leaf of leaves) {
		const file = leaf.view?.file;
		if (!file || file.extension !== "md") continue;

		// Skip codex files - no toolbars for them
		if (file.basename.startsWith("__")) continue;

		// Obsidian leaf.id is not in public API, accessing via any
		const leafId = (leaf as any).id as string | undefined;
		if (!leafId) continue;
		activeLeafIds.add(leafId);

		const container = leaf.view.containerEl?.querySelector(".view-content");
		if (!container || !(container instanceof HTMLElement)) continue;

		// Read page metadata for nav button state
		const pageMetadata = getPageMetadata(leaf.view as MarkdownView);
		const navActions = computeNavActions(pageMetadata);

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
			zones.attach(container, leaf.view as MarkdownView);
			zones.setNavActions(navActions);
			edgeZones.set(leafId, zones);
		} else {
			edgeZones.get(leafId)?.setNavActions(navActions);
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

	// Remove edge zones for closed leaves
	for (const [leafId, zones] of edgeZones) {
		if (!activeLeafIds.has(leafId)) {
			zones.destroy();
			edgeZones.delete(leafId);
		}
	}
}
