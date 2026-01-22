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
	tryReattachWithRetry: (filePath: string) => void;
	hideSelectionToolbar: () => void;
	getContext: () => OverlayContext | null;
	getServices: () => OverlayManagerServices | null;
};

/**
 * State for tracking pending file navigation.
 */
export type EventCoordinatorState = {
	pendingFilePath: string | null;
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
 * Returns state object that can be read/modified by callbacks.
 */
export function setupEventSubscriptions(
	app: App,
	plugin: Plugin,
	callbacks: EventCoordinatorCallbacks,
): EventCoordinatorState {
	const state: EventCoordinatorState = {
		pendingFilePath: null,
	};

	// Initial recompute on layout ready - wait for view DOM to be ready
	app.workspace.onLayoutReady(async () => {
		await waitForActiveViewReady(app);
		await callbacks.recompute();
		callbacks.reattachUI();
	});

	// Reattach when user switches panes/notes
	// Only reattach if the new leaf is a MarkdownView - otherwise skip to avoid detaching during transitions
	plugin.registerEvent(
		app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf | null) => {
			const view = leaf?.view;
			const isMarkdown = view instanceof MarkdownView;
			if (!isMarkdown) {
				return;
			}
			callbacks.scheduleRecompute();
			callbacks.reattachUI();
		}),
	);

	// On file-open: record the path for layout-change to handle
	// Don't try to reattach here - MarkdownView isn't ready yet
	plugin.registerEvent(
		app.workspace.on("file-open", (file) => {
			if (!file) return;
			state.pendingFilePath = file.path;
		}),
	);

	// Listen for custom event from cd() when view DOM is ready
	// This handles navigation via plugin's page nav buttons
	plugin.registerEvent(
		// @ts-expect-error - custom event not in Obsidian types
		app.workspace.on("textfresser:file-ready", (file: TFile) => {
			// Clear pending since cd() already waited for view
			state.pendingFilePath = null;
			callbacks.reattachUIForFile(file.path);
			void callbacks.recomputeForFile(file.path);
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
	// Only reattach if there's a markdown view - skip during transitions to avoid detaching
	plugin.registerEvent(
		app.workspace.on("layout-change", () => {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (state.pendingFilePath) {
				const filePath = state.pendingFilePath;
				state.pendingFilePath = null;
				callbacks.tryReattachWithRetry(filePath);
			} else if (view) {
				// Only reattach if there's a markdown view
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
							executeAction(
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

	return state;
}
