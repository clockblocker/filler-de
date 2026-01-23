/**
 * LeafLifecycleManager - single source of truth for view lifecycle.
 *
 * Absorbs NavigationState + all DOM waiting logic into one place.
 * Subscribers get clean lifecycle events without knowing Obsidian quirks.
 *
 * Events emitted:
 * - view-ready: View DOM is ready for UI attachment
 * - view-detaching: View is about to change (detach UI)
 * - layout-changed: Layout changed without navigation
 */

import { type App, MarkdownView, type Plugin, type TFile } from "obsidian";
import { DomSelectors } from "../../../utils/dom-selectors";
import { waitForDomCondition } from "../../../utils/dom-waiter";
import { logger } from "../../../utils/logger";
import type {
	LeafLifecycleEvent,
	LeafLifecycleHandler,
	LifecycleTeardown,
} from "./types";

/**
 * Internal navigation state machine.
 * Tracks whether we're idle or navigating.
 */
type NavigationState = {
	status: "idle" | "navigating";
	pendingPath: string | null;
};

export class LeafLifecycleManager {
	private readonly subscribers = new Set<LeafLifecycleHandler>();
	private navState: NavigationState = {
		pendingPath: null,
		status: "idle",
	};
	private currentFilePath: string | null = null;
	private initialized = false;

	constructor(
		private readonly app: App,
		private readonly plugin: Plugin,
	) {}

	/**
	 * Subscribe to lifecycle events.
	 * Returns teardown function to unsubscribe.
	 */
	subscribe(handler: LeafLifecycleHandler): LifecycleTeardown {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Initialize the manager and wire up Obsidian events.
	 * Call this once after plugin is ready.
	 */
	init(): void {
		if (this.initialized) return;
		this.initialized = true;

		// Initial setup on layout ready
		this.app.workspace.onLayoutReady(async () => {
			await this.handleInitialLayout();
		});

		// Track file-open events for external navigation
		this.plugin.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				this.handleFileOpen(file);
			}),
		);

		// Handle active leaf changes
		this.plugin.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.handleActiveLeafChange(leaf);
			}),
		);

		// Handle layout changes (splits, etc.)
		this.plugin.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.handleLayoutChange();
			}),
		);

		// Listen for plugin-initiated navigation completion
		this.plugin.registerEvent(
			// @ts-expect-error - custom event not in Obsidian types
			this.app.workspace.on("textfresser:file-ready", (file: TFile) => {
				this.handlePluginNavComplete(file);
			}),
		);
	}

	/**
	 * Signal that plugin is about to navigate to a file via cd().
	 * This prevents spurious event handlers from firing.
	 */
	beginPluginNavigation(targetPath: string): void {
		// Emit detaching event for current view
		if (this.currentFilePath) {
			this.emit({
				kind: "view-detaching",
				previousFilePath: this.currentFilePath,
			});
		}

		this.navState = {
			pendingPath: targetPath,
			status: "navigating",
		};
	}

	/**
	 * Get current file path (if any).
	 */
	getCurrentFilePath(): string | null {
		return this.currentFilePath;
	}

	/**
	 * Check if navigation is in progress.
	 */
	isNavigating(): boolean {
		return this.navState.status === "navigating";
	}

	// ─── Private ───

	private emit(event: LeafLifecycleEvent): void {
		for (const handler of this.subscribers) {
			try {
				handler(event);
			} catch (error) {
				logger.error("[LeafLifecycleManager] Handler error:", error);
			}
		}
	}

	private async handleInitialLayout(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return;

		await this.waitForViewReady(view);

		this.currentFilePath = view.file.path;
		this.emit({
			filePath: view.file.path,
			kind: "view-ready",
		});
	}

	private handleFileOpen(file: TFile | null): void {
		logger.info(
			`[LeafLifecycle] handleFileOpen: ${JSON.stringify({ filePath: file?.path, currentStatus: this.navState.status, currentFilePath: this.currentFilePath })}`,
		);

		if (!file) return;

		// If plugin nav is in progress, ignore file-open
		// The plugin will trigger textfresser:file-ready when done
		if (this.navState.status === "navigating") {
			logger.info("[LeafLifecycle] handleFileOpen: already navigating, ignoring");
			return;
		}

		// Same file click - no navigation needed
		if (this.currentFilePath === file.path) {
			logger.info("[LeafLifecycle] handleFileOpen: same file, ignoring");
			return;
		}

		// External navigation (wikilink, file explorer, etc.)
		// Emit detaching for current view
		if (this.currentFilePath && this.currentFilePath !== file.path) {
			this.emit({
				kind: "view-detaching",
				previousFilePath: this.currentFilePath,
			});
		}

		this.navState = {
			pendingPath: file.path,
			status: "navigating",
		};
		logger.info(`[LeafLifecycle] handleFileOpen: set navigating to ${file.path}`);
	}

	private handleActiveLeafChange(leaf: unknown): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const viewFilePath = view?.file?.path ?? null;

		logger.info(
			`[LeafLifecycle] handleActiveLeafChange: ${JSON.stringify({ viewFile: viewFilePath, status: this.navState.status, currentFilePath: this.currentFilePath })}`,
		);

		// Complete pending navigation if any
		if (this.navState.status === "navigating") {
			if (!view?.file) {
				logger.info("[LeafLifecycle] handleActiveLeafChange: navigating but no view file, waiting");
				return;
			}
			logger.info("[LeafLifecycle] handleActiveLeafChange: completing navigation");
			void this.completeNavigation(view);
		} else {
			// Idle state - emit layout-changed to trigger UI reattachment
			// Use currentFilePath as fallback when view.file is temporarily null (same file click)
			const filePath = viewFilePath ?? this.currentFilePath;
			if (filePath) {
				logger.info(`[LeafLifecycle] handleActiveLeafChange: idle, emitting layout-changed for ${filePath}`);
				this.emit({
					currentFilePath: filePath,
					kind: "layout-changed",
				});
			}
		}
	}

	private handleLayoutChange(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		logger.info(
			`[LeafLifecycle] handleLayoutChange: ${JSON.stringify({ viewFile: view?.file?.path, status: this.navState.status })}`,
		);

		// For pending navigation, try to complete
		if (this.navState.status === "navigating") {
			if (view?.file) {
				logger.info("[LeafLifecycle] handleLayoutChange: completing pending navigation");
				void this.completeNavigation(view);
			}
			return;
		}

		// Otherwise just emit layout-changed
		const currentPath = view?.file?.path ?? null;
		logger.info(`[LeafLifecycle] handleLayoutChange: emitting layout-changed for ${currentPath}`);
		this.emit({
			currentFilePath: currentPath,
			kind: "layout-changed",
		});
	}

	private handlePluginNavComplete(file: TFile): void {
		// Complete plugin navigation
		this.navState = { pendingPath: null, status: "idle" };
		this.currentFilePath = file.path;

		this.emit({
			filePath: file.path,
			kind: "view-ready",
		});
	}

	private async completeNavigation(view: MarkdownView): Promise<void> {
		const file = view.file;
		logger.info(`[LeafLifecycle] completeNavigation: ${JSON.stringify({ viewFile: file?.path })}`);

		if (!file) return;

		// Wait for DOM ready
		await this.waitForViewReady(view);
		logger.info(`[LeafLifecycle] completeNavigation: DOM ready for ${file.path}`);

		// Complete navigation state
		this.navState = { pendingPath: null, status: "idle" };
		this.currentFilePath = file.path;

		logger.info(`[LeafLifecycle] completeNavigation: emitting view-ready for ${file.path}`);
		this.emit({
			filePath: file.path,
			kind: "view-ready",
		});
	}

	private async waitForViewReady(view: MarkdownView): Promise<void> {
		const isReady = () => {
			return !!view.contentEl.querySelector(
				DomSelectors.CM_CONTENT_CONTAINER,
			);
		};

		await waitForDomCondition(isReady, { timeout: 500 });
	}
}
