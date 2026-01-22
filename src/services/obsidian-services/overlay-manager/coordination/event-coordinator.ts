import {
	type App,
	MarkdownView,
	type Menu,
	type Plugin,
	type TFile,
	type WorkspaceLeaf,
} from "obsidian";
import { FileType } from "../../../../types/common-interface/enums";
import { waitForDomCondition } from "../../../../utils/dom-waiter";
import { executeAction } from "../executor-registry";
import { ActionKind, ActionPlacement, type OverlayContext } from "../types";
import type { NavigationState } from "./navigation-state";
import type { OverlayManagerServices } from "./recompute-coordinator";

/**
 * Callbacks provided by OverlayManager for event handling.
 */
export type EventCoordinatorCallbacks = {
	scheduleRecompute: () => void;
	recompute: () => Promise<void>;
	recomputeForFile: (filePath: string) => Promise<void>;
	reattachUI: () => void;
	reattachUIForFile: (filePath: string) => void;
	tryReattachWithRetry: (filePath: string) => Promise<void>;
	completeNavigation: (filePath: string) => Promise<void>;
	hideSelectionToolbar: () => void;
	getContext: () => OverlayContext | null;
	getServices: () => OverlayManagerServices | null;
};

/**
 * Wait for the active view to be ready (DOM rendered) using MutationObserver.
 * Returns when `.cm-contentContainer` appears in any active MarkdownView.
 */
async function waitForActiveViewReady(
	app: App,
	timeoutMs = 500,
): Promise<void> {
	const check = () => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		return !!view?.contentEl.querySelector(".cm-contentContainer");
	};
	await waitForDomCondition(check, { timeout: timeoutMs });
}

/**
 * Setup all event subscriptions for OverlayManager.
 * Uses NavigationState to prevent race conditions between events.
 */
export function setupEventSubscriptions(
	app: App,
	plugin: Plugin,
	callbacks: EventCoordinatorCallbacks,
	navState: NavigationState,
): void {

	// Initial recompute on layout ready - wait for view DOM to be ready
	app.workspace.onLayoutReady(async () => {
		await waitForActiveViewReady(app);
		await callbacks.recompute();
		callbacks.reattachUI();
	});

	// Reattach when user switches panes/notes
	// Skip if navigation in progress - file-ready or layout-change will handle it
	plugin.registerEvent(
		app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf | null) => {
			if (navState.isNavigating()) {
				return;
			}
			const view = leaf?.view;
			const isMarkdown = view instanceof MarkdownView;
			if (!isMarkdown) {
				return;
			}
			callbacks.scheduleRecompute();
			callbacks.reattachUI();
		}),
	);

	// On file-open: record path for external navigation (wikilinks, file explorer)
	// No-op if plugin nav in progress (cd() already called startPluginNav)
	plugin.registerEvent(
		app.workspace.on("file-open", (file) => {
			if (!file) return;
			navState.startExternalNav(file.path);
		}),
	);

	// Listen for custom event from cd() when view DOM is ready
	// This is the SINGLE AUTHORITY for plugin-initiated navigation
	plugin.registerEvent(
		// @ts-expect-error - custom event not in Obsidian types
		app.workspace.on("textfresser:file-ready", async (file: TFile) => {
			navState.complete();
			await callbacks.completeNavigation(file.path);
		}),
	);

	// Show selection toolbar after drag
	plugin.registerDomEvent(document, "dragend", async () => {
		await callbacks.recompute();
	});

	// Show selection toolbar after mouse selection
	// Skip recompute if clicking on action buttons (prevents destroying button mid-click)
	plugin.registerDomEvent(document, "mouseup", async (evt) => {
		const target = evt.target as HTMLElement;
		if (target.closest("[data-action]")) {
			return; // Don't recompute when clicking action buttons
		}
		await callbacks.recompute();
	});

	// Show selection toolbar after keyboard selection
	plugin.registerDomEvent(document, "keyup", async (evt: KeyboardEvent) => {
		const selectionKeys = [
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Shift",
			"Home",
			"End",
			"PageUp",
			"PageDown",
			"a",
		];

		if (evt.shiftKey || selectionKeys.includes(evt.key)) {
			await callbacks.recompute();
		}
	});

	// Re-check after major layout changes (splits, etc.)
	// Skip if plugin nav - file-ready handles it
	plugin.registerEvent(
		app.workspace.on("layout-change", async () => {
			if (navState.isPluginNav()) {
				return;
			}
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			const pendingPath = navState.getPendingPath();
			if (pendingPath) {
				navState.complete();
				await callbacks.tryReattachWithRetry(pendingPath);
			} else if (view) {
				callbacks.scheduleRecompute();
				callbacks.reattachUI();
			}
		}),
	);

	// Handle CSS changes - hide selection toolbar
	plugin.registerEvent(
		app.workspace.on("css-change", () => callbacks.hideSelectionToolbar()),
	);

	// Register "Split into pages" in editor context menu
	// Uses currentContext (synchronous) since menu callbacks must be sync
	plugin.registerEvent(
		app.workspace.on("editor-menu", (menu: Menu) => {
			const ctx = callbacks.getContext();
			if (!ctx) return;

			const shouldShow =
				ctx.isInLibrary &&
				(ctx.fileType === null ||
					(ctx.fileType === FileType.Scroll &&
						ctx.wouldSplitToMultiplePages));

			if (shouldShow) {
				menu.addItem((item) =>
					item
						.setTitle("Split into pages")
						.setIcon("split")
						.onClick(() => {
							const services = callbacks.getServices();
							if (!services) return;
							void executeAction(
								{
									id: "MakeText",
									kind: ActionKind.MakeText,
									label: "Split into pages",
									params: {},
									placement: ActionPlacement.Bottom,
									priority: 2,
								},
								{
									apiService: services.apiService,
									app: app,
									selectionService: services.selectionService,
									vaultActionManager:
										services.vaultActionManager,
								},
							);
						}),
				);
			}
		}),
	);

}
