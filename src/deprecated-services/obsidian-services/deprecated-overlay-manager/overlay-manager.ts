import type { App, Menu, Plugin } from "obsidian";
import { createActionExecutor } from "../../../managers/actions-manager/create-action-executor";
import type {
	Teardown,
	UserEvent,
} from "../../../managers/obsidian/user-event-interceptor/types/user-event";
import { FileType } from "../../../types/common-interface/enums";
import { DebounceScheduler } from "../../../utils/debounce-scheduler";
import { nextPaint } from "../../../utils/dom-waiter";
import { logger } from "../../../utils/logger";
import { DeprecatedBottomToolbarService } from "../deprecated-button-manager/bottom-toolbar";
import { EdgePaddingNavigator } from "../deprecated-button-manager/edge-padding-navigator";
import { NavigationLayoutCoordinator } from "../deprecated-button-manager/navigation-layout-coordinator";
import type { DeprecatedAboveSelectionToolbarService } from "../deprecated-button-manager/selection-toolbar";
import { handleActionClick } from "./actions";
import {
	buildOverlayContext,
	buildOverlayContextForFile,
	type ContextBuilderDeps,
} from "./context";
import {
	type DeprecatedOverlayManagerServices,
	reattachUI as doReattachUI,
	reattachUIForFile as doReattachUIForFile,
	executeRecompute,
	type ReattachDeps,
	type ToolbarServices,
} from "./coordination";
import {
	ActionKind,
	ActionPlacement,
	type CommanderActionProvider,
	type OverlayContext,
} from "./types";

export type { DeprecatedOverlayManagerServices as OverlayManagerServices };

/**
 * OverlayManager - unified facade for all overlay UI.
 * Thin orchestrator that delegates to extracted modules.
 *
 * Responsibilities:
 * - Subscribe to user behaviors (selection, navigation, resize)
 * - Query registered CommanderActionProviders for available actions
 * - Render appropriate UI (bottom bar, selection toolbar, edge zones)
 * - Handle clicks -> dispatch to ActionExecutorRegistry
 * @deprecated
 */
export class DeprecatedOverlayManager {
	private static readonly DEBOUNCE_MS = 50;

	// Toolbar services
	private bottom: DeprecatedBottomToolbarService;
	private selection: DeprecatedAboveSelectionToolbarService;
	private edgePaddingNavigator: EdgePaddingNavigator;
	private layoutCoordinator: NavigationLayoutCoordinator;

	// Commander providers
	private providers: CommanderActionProvider[] = [];

	// State
	private services: DeprecatedOverlayManagerServices | null = null;
	private currentContext: OverlayContext | null = null;
	private debouncer: DebounceScheduler;
	private recomputeDebouncer: DebounceScheduler;
	private lifecycleTeardown: LifecycleTeardown | null = null;
	private userEventTeardown: Teardown | null = null;

	// Cached deps
	private contextBuilderDeps: ContextBuilderDeps | null = null;
	private toolbarServices: ToolbarServices;
	private reattachDeps: ReattachDeps;

	constructor(
		private app: App,
		private plugin: Plugin,
	) {
		this.bottom = new DeprecatedBottomToolbarService(this.app);
		this.selection = new AboveSelectionToolbarService(this.app);
		this.edgePaddingNavigator = new EdgePaddingNavigator();
		this.layoutCoordinator = new NavigationLayoutCoordinator(
			this.edgePaddingNavigator,
			this.bottom,
		);

		this.debouncer = new DebounceScheduler(
			DeprecatedOverlayManager.DEBOUNCE_MS,
		);
		this.recomputeDebouncer = new DebounceScheduler(
			DeprecatedOverlayManager.DEBOUNCE_MS,
		);

		// Cache deps (contextBuilderDeps set in init when services available)
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
	public init(services: DeprecatedOverlayManagerServices): void {
		this.services = services;

		// Initialize context builder deps with vaultActionManager
		this.contextBuilderDeps = {
			app: this.app,
		};

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
		logger.info(
			`[OverlayManager] handleLifecycleEvent: ${JSON.stringify(event)}`,
		);

		switch (event.kind) {
			case "view-ready":
				// View DOM is ready - use unified attachment flow
				void this.attach(event.filePath);
				break;

			case "view-detaching":
				// View is about to change - nothing to do currently
				// UI will be reattached when view-ready fires
				break;

			case "layout-changed":
				// Layout changed without navigation - schedule attachment
				this.scheduleAttachment(event.currentFilePath);
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
						getCurrentContext: () => this.currentContext,
						getLibrarian: () => this.services?.librarian ?? null,
						getProviders: () => this.providers,
						getSelectionService: () =>
							this.services?.selectionService ?? null,
						getVaultActionManager: () =>
							this.services!.vaultActionManager,
					},
					event.actionId,
				);
				break;

			case "SelectionChanged":
				// Selection changed - trigger recompute to update selection toolbar
				this.scheduleRecompute();
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
								const executor = createActionExecutor({
									librarian: this.services.librarian ?? null,
									vaultActionManager:
										this.services.vaultActionManager,
								});
								void executor({
									kind: ActionKind.MakeText,
									payload: {},
								});
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
		if (!this.contextBuilderDeps) return;
		const ctx = await buildOverlayContext(this.contextBuilderDeps);
		this.currentContext = ctx;
		executeRecompute(ctx, this.providers, this.toolbarServices);
	}

	/**
	 * Recompute with fallback to find view by file path.
	 */
	private async recomputeForFile(filePath: string): Promise<void> {
		logger.info(`[OverlayManager] recomputeForFile: ${filePath}`);
		if (!this.contextBuilderDeps) {
			logger.info(
				"[OverlayManager] recomputeForFile: no contextBuilderDeps",
			);
			return;
		}
		const ctx = await buildOverlayContextForFile(
			this.contextBuilderDeps,
			filePath,
		);
		logger.info(
			`[OverlayManager] recomputeForFile: context computed - ${JSON.stringify({ fileType: ctx.fileType, hasNextPage: ctx.hasNextPage, hasPrevPage: ctx.hasPrevPage, path: ctx.path })}`,
		);
		this.currentContext = ctx;
		executeRecompute(ctx, this.providers, this.toolbarServices);
	}

	/**
	 * Schedule a debounced recompute.
	 * Uses separate debouncer to avoid canceling attachment operations.
	 */
	public scheduleRecompute(): void {
		this.recomputeDebouncer.schedule(() => void this.recompute());
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
	 * Unified attachment - single entry point for all view-ready events.
	 * Cancels debouncer, waits for Obsidian render, then recomputes and reattaches.
	 */
	private async attach(filePath: string): Promise<void> {
		logger.info(`[OverlayManager] attach: starting for ${filePath}`);
		this.debouncer.cancel();
		this.recomputeDebouncer.cancel(); // Cancel pending generic recompute that may see null view.file
		await nextPaint(); // Wait for Obsidian to finish rendering
		logger.info(`[OverlayManager] attach: nextPaint done for ${filePath}`);
		await this.recomputeForFile(filePath);
		logger.info(`[OverlayManager] attach: recompute done for ${filePath}`);
		this.reattachUIForFile(filePath);
		logger.info(`[OverlayManager] attach: reattach done for ${filePath}`);
	}

	/**
	 * Schedule debounced attachment for layout changes.
	 */
	private scheduleAttachment(filePath: string | null): void {
		this.recomputeDebouncer.cancel(); // Cancel pending generic recompute that may see null view.file
		this.debouncer.schedule(async () => {
			await nextPaint();
			if (filePath) {
				await this.recomputeForFile(filePath);
				this.reattachUIForFile(filePath);
			} else {
				await this.recompute();
				this.reattachUI();
			}
		});
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
		this.recomputeDebouncer.destroy();
		this.bottom.detach();
		this.selection.destroy();
		this.layoutCoordinator.detach();
	}
}
