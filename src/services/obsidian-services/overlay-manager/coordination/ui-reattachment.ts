import { type App, MarkdownView } from "obsidian";
import { waitForDomCondition } from "../../../../utils/dom-waiter";
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
	recompute: () => Promise<void>;
	reattachUI: () => void;
};

/**
 * Try to reattach UI with retry mechanism using MutationObserver.
 * Waits for view DOM to be ready (`.cm-contentContainer` present) before reattaching.
 * This handles the case where layout-change fires before view is fully ready.
 *
 * IMPORTANT: This function is now async and awaits everything to prevent race conditions.
 */
export async function tryReattachWithRetry(
	deps: ReattachDeps,
	filePath: string,
	callbacks: RetryCallbacks,
): Promise<void> {
	const TIMEOUT_MS = 500;

	// Check if view is ready: correct file AND DOM rendered
	const isViewReady = () => {
		const view =
			getMarkdownViewForFile(deps.app, filePath) ??
			deps.app.workspace.getActiveViewOfType(MarkdownView);
		return (
			view?.file?.path === filePath &&
			!!view.contentEl.querySelector(".cm-contentContainer")
		);
	};

	// Wait for view DOM to be ready using MutationObserver
	await waitForDomCondition(isViewReady, { timeout: TIMEOUT_MS });

	if (isViewReady()) {
		// Recompute FIRST to update actionConfigs, THEN reattach with correct buttons
		await callbacks.recomputeForFile(filePath);
		callbacks.reattachUIForFile(filePath);
	} else {
		// Timeout reached - fall back to standard recompute
		logger.warn(
			`[OverlayManager] View not ready after ${TIMEOUT_MS}ms for: ${filePath}`,
		);
		await callbacks.recompute();
		callbacks.reattachUI();
	}
}
