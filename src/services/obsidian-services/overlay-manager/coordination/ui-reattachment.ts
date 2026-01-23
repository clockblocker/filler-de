import { type App, MarkdownView } from "obsidian";
import { logger } from "../../../../utils/logger";
import type { BottomToolbarService } from "../../button-manager/bottom-toolbar";
import type { NavigationLayoutCoordinator } from "../../button-manager/navigation-layout-coordinator";
import { getMarkdownViewForFile } from "../context";

/**
 * Dependencies for UI reattachment operations.
 */
export type ReattachDeps = {
	app: App;
	bottom: BottomToolbarService;
	layoutCoordinator: NavigationLayoutCoordinator;
};

/**
 * Reattach UI elements to current active view.
 */
export function reattachUI(deps: ReattachDeps): void {
	deps.bottom.reattach();

	const view = deps.app.workspace.getActiveViewOfType(MarkdownView);
	if (view) {
		deps.layoutCoordinator.attach(view, deps.bottom.isMobile());
	} else {
		deps.layoutCoordinator.detach();
	}
}

/**
 * Reattach UI elements for a specific file path.
 * Used when getActiveViewOfType returns null but we know which file was opened.
 */
export function reattachUIForFile(deps: ReattachDeps, filePath: string): void {
	logger.info(`[UIReattach] reattachUIForFile: ${filePath}`);

	deps.bottom.reattachForFile(filePath);

	// Try getActiveViewOfType first, but only use if it matches expected path
	let view = deps.app.workspace.getActiveViewOfType(MarkdownView);
	const activeViewPath = view?.file?.path;

	logger.info(`[UIReattach] activeViewPath: ${activeViewPath ?? "null"}`);

	// Only use active view if it matches expected file path
	if (view?.file?.path !== filePath) {
		logger.info("[UIReattach] active view mismatch, searching by path");
		view = getMarkdownViewForFile(deps.app, filePath);
		logger.info(`[UIReattach] found view by path: ${view?.file?.path ?? "null"}`);
	}

	if (view) {
		logger.info("[UIReattach] attaching layoutCoordinator");
		deps.layoutCoordinator.attach(view, deps.bottom.isMobile());
	} else {
		logger.info("[UIReattach] no view, detaching layoutCoordinator");
		deps.layoutCoordinator.detach();
	}
}
