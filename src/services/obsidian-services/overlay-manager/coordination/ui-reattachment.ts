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
	deps.bottom.reattachForFile(filePath);

	// Try getActiveViewOfType first
	let view = deps.app.workspace.getActiveViewOfType(MarkdownView);

	// Fallback: find view by file path using getLeavesOfType
	if (!view) {
		view = getMarkdownViewForFile(deps.app, filePath);
	}

	if (view) {
		deps.layoutCoordinator.attach(view, deps.bottom.isMobile());
	} else {
		deps.layoutCoordinator.detach();
	}
}

/**
 * Callbacks for retry operation.
 */
export type RetryCallbacks = {
	reattachUIForFile: (filePath: string) => void;
	recomputeForFile: (filePath: string) => Promise<void>;
	scheduleRecompute: () => void;
	reattachUI: () => void;
};

/**
 * Try to reattach UI with retry mechanism using requestAnimationFrame.
 * This handles the case where layout-change fires before view is fully ready.
 */
export function tryReattachWithRetry(
	deps: ReattachDeps,
	filePath: string,
	callbacks: RetryCallbacks,
	attempt = 0,
): void {
	const MAX_ATTEMPTS = 5;

	const view =
		getMarkdownViewForFile(deps.app, filePath) ??
		deps.app.workspace.getActiveViewOfType(MarkdownView);

	if (view?.file?.path === filePath) {
		// View is ready - reattach and recompute
		callbacks.reattachUIForFile(filePath);
		void callbacks.recomputeForFile(filePath);
	} else if (attempt < MAX_ATTEMPTS) {
		// Retry in next animation frame
		requestAnimationFrame(() =>
			tryReattachWithRetry(deps, filePath, callbacks, attempt + 1),
		);
	} else {
		// Max retries reached - fall back to standard recompute
		logger.warn(
			`[OverlayManager] View not ready after ${MAX_ATTEMPTS} attempts for: ${filePath}`,
		);
		callbacks.scheduleRecompute();
		callbacks.reattachUI();
	}
}
