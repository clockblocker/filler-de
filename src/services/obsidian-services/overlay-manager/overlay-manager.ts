import type { App, Menu, Plugin } from "obsidian";
import type {
	LeafLifecycleEvent,
	LifecycleTeardown,
} from "../../../managers/obsidian/leaf-lifecycle-manager";
import type {
	Teardown,
	UserEvent,
} from "../../../managers/obsidian/user-event-interceptor/types/user-event";
import { FileType } from "../../../types/common-interface/enums";
import { DebounceScheduler } from "../../../utils/debounce-scheduler";
import { BottomToolbarService } from "../button-manager/bottom-toolbar";
import { EdgePaddingNavigator } from "../button-manager/edge-padding-navigator";
import { NavigationLayoutCoordinator } from "../button-manager/navigation-layout-coordinator";
import { AboveSelectionToolbarService } from "../button-manager/selection-toolbar";
import { handleActionClick } from "./actions";
import {
	buildOverlayContext,
	buildOverlayContextForFile,
	type ContextBuilderDeps,
} from "./context";
import {
	reattachUI as doReattachUI,
	reattachUIForFile as doReattachUIForFile,
	executeRecompute,
	type OverlayManagerServices,
	type ReattachDeps,
	type ToolbarServices,
} from "./coordination";
import { executeAction } from "./executor-registry";
import {
	ActionKind,
	ActionPlacement,
	type CommanderActionProvider,
	type OverlayContext,
} from "./types";

export type { OverlayManagerServices };

/**
 * OverlayManager - unified facade for all overlay UI.
 * Thin orchestrator that delegates to extracted modules.
 *
 * Responsibilities:
 * - Subscribe to user behaviors (selection, navigation, resize)
 * - Query registered CommanderActionProviders for available actions
 * - Render appropriate UI (bottom bar, selection toolbar, edge zones)
 * - Handle clicks -> dispatch to ActionExecutorRegistry
 */
export class OverlayManager {
	private static readonly DEBOUNCE_MS = 50;

	// Toolbar services
	private bottom: BottomToolbarService;
	private selection: AboveSelectionToolbarService;
	private edgePaddingNavigator: EdgePaddingNavigator;
	private layoutCoordinator: NavigationLayoutCoordinator;

	// Commander providers
	private providers: CommanderActionProvider[] = [];

	// State
	private services: OverlayManagerServices | null = null;
	private currentContext: OverlayContext | null = null;
	private debouncer: DebounceScheduler;
	private lifecycleTeardown: LifecycleTeardown | null = null;
	private userEventTeardown: Teardown | null = null;

	// Cached deps
	private contextBuilderDeps: ContextBuilderDeps;
	private toolbarServices: ToolbarServices;
	private reattachDeps: ReattachDeps;

	constructor(
		private app: App,
		private plugin: Plugin,
	) {
		this.bottom = new BottomToolbarService(this.app);
		this.selection = new AboveSelectionToolbarService(this.app);
		this.edgePaddingNavigator = new EdgePaddingNavigator();
		this.layoutCoordinator = new NavigationLayoutCoordinator(
			this.edgePaddingNavigator,
			this.bottom,
		);

		this.debouncer = new DebounceScheduler(OverlayManager.DEBOUNCE_MS);

		// Cache deps
		this.contextBuilderDeps = { app: this.app };
		this.toolbarServices = {
			bottom: this.bottom,
			layoutCoordinator: this.layoutCoordinator,
			selection: this.selection,
		};
		this.reattachDeps = {
			app: this.app,
			bottom: this.bottom,
			layoutCoordinator: this.layoutCoordinator,
		};
	}

	/**
	 * Register a commander action provider.
	 * Providers are sorted by priority (lower = higher priority).
	 */
	public registerProvider(provider: CommanderActionProvider): void {
		this.providers.push(provider);
		this.providers.sort((a, b) => a.priority - b.priority);
	}

	/**
	 * Initialize with services and wire up all event subscriptions.
	 */
	public init(services: OverlayManagerServices): void {
		this.services = services;

		// Initialize bottom toolbar
		this.bottom.init();

		// Subscribe to LeafLifecycleManager events
		// Handles: view-ready, view-detaching, layout-changed
		if (services.leafLifecycleManager) {
			this.lifecycleTeardown = services.leafLifecycleManager.subscribe(
				(event) => this.handleLifecycleEvent(event),
			);
		}

		// Subscribe to UserEventInterceptor events
		// Handles: ActionClicked (toolbar buttons), SelectionChanged (recompute trigger)
		if (services.userEventInterceptor) {
			this.userEventTeardown = services.userEventInterceptor.subscribe(
				(event) => this.handleUserEvent(event),
			);
		}

		// Register context menu (Split into pages)
		// This is kept here since it's UI-related and doesn't fit elsewhere
		this.setupContextMenu();

		// Handle CSS changes - hide selection toolbar
		this.plugin.registerEvent(
			this.app.workspace.on("css-change", () => this.selection.hide()),
		);

		// Initial recompute and reattach on layout ready
		this.app.workspace.onLayoutReady(async () => {
			await this.recompute();
			this.reattachUI();
		});
	}

	/**
	 * Handle lifecycle events from LeafLifecycleManager.
	 * This replaces the old event-coordinator approach.
	 */
	private handleLifecycleEvent(event: LeafLifecycleEvent): void {
		switch (event.kind) {
			case "view-ready":
				// View DOM is ready - recompute and reattach UI
				// For plugin nav: debouncer cancelled, recompute for specific file
				// For external nav: just recompute and reattach
				if (event.origin === "plugin") {
					void this.completeNavigation(event.filePath);
				} else {
					this.scheduleRecompute();
					this.reattachUI();
				}
				break;

			case "view-detaching":
				// View is about to change - nothing to do currently
				// UI will be reattached when view-ready fires
				break;

			case "layout-changed":
				// Layout changed without navigation - reattach may be needed
				this.scheduleRecompute();
				this.reattachUI();
				break;
		}
	}

	/**
	 * Handle user events from UserEventInterceptor.
	 * This replaces setupDelegatedClickHandler and event-coordinator selection handling.
	 */
	private handleUserEvent(event: UserEvent): void {
		switch (event.kind) {
			case "ActionClicked":
				// Action button clicked - execute the action
				void handleActionClick(
					{
						app: this.app,
						getCurrentContext: () => this.currentContext,
						getProviders: () => this.providers,
						getServices: () => this.services,
					},
					event.actionId,
				);
				break;

			case "SelectionChanged":
				// Selection changed - trigger recompute to update selection toolbar
				void this.recompute();
				break;

			// Other events are handled by Librarian, not OverlayManager
			default:
				break;
		}
	}

	/**
	 * Setup context menu for "Split into pages" action.
	 */
	private setupContextMenu(): void {
		this.plugin.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu) => {
				const ctx = this.currentContext;
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
								if (!this.services) return;
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
										apiService: this.services.apiService,
										app: this.app,
										selectionService:
											this.services.selectionService,
										vaultActionManager:
											this.services.vaultActionManager,
									},
								);
							}),
					);
				}
			}),
		);
	}

	/**
	 * Recompute available actions and notify toolbar services.
	 */
	public async recompute(): Promise<void> {
		const ctx = await buildOverlayContext(this.contextBuilderDeps);
		this.currentContext = ctx;
		executeRecompute(ctx, this.providers, this.toolbarServices);
	}

	/**
	 * Recompute with fallback to find view by file path.
	 */
	private async recomputeForFile(filePath: string): Promise<void> {
		const ctx = await buildOverlayContextForFile(
			this.contextBuilderDeps,
			filePath,
		);
		this.currentContext = ctx;
		executeRecompute(ctx, this.providers, this.toolbarServices);
	}

	/**
	 * Schedule a debounced recompute.
	 */
	public scheduleRecompute(): void {
		this.debouncer.schedule(() => void this.recompute());
	}

	/**
	 * Reattach UI elements to current view.
	 */
	private reattachUI(): void {
		doReattachUI(this.reattachDeps);
	}

	/**
	 * Reattach UI elements for a specific file path.
	 */
	private reattachUIForFile(filePath: string): void {
		doReattachUIForFile(this.reattachDeps, filePath);
	}

	/**
	 * Complete navigation - single entry point for plugin-initiated navigation.
	 * Cancels debouncer, awaits recompute, then reattaches UI.
	 */
	private async completeNavigation(filePath: string): Promise<void> {
		this.debouncer.cancel();
		await this.recomputeForFile(filePath);
		this.reattachUIForFile(filePath);
	}

	/**
	 * Get current context (for external use).
	 */
	public getContext(): OverlayContext | null {
		return this.currentContext;
	}

	/**
	 * Cleanup - destroy all toolbar services.
	 */
	public destroy(): void {
		if (this.lifecycleTeardown) {
			this.lifecycleTeardown();
			this.lifecycleTeardown = null;
		}
		if (this.userEventTeardown) {
			this.userEventTeardown();
			this.userEventTeardown = null;
		}
		this.debouncer.destroy();
		this.bottom.detach();
		this.selection.destroy();
		this.layoutCoordinator.detach();
	}
}
