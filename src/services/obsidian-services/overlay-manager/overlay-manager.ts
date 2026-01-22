import type { App, Plugin } from "obsidian";
import { DebounceScheduler } from "../../../utils/debounce-scheduler";
import { BottomToolbarService } from "../button-manager/bottom-toolbar";
import { EdgePaddingNavigator } from "../button-manager/edge-padding-navigator";
import { NavigationLayoutCoordinator } from "../button-manager/navigation-layout-coordinator";
import { AboveSelectionToolbarService } from "../button-manager/selection-toolbar";
import { handleActionClick, setupDelegatedClickHandler } from "./actions";
import {
	buildOverlayContext,
	buildOverlayContextForFile,
	type ContextBuilderDeps,
} from "./context";
import {
	reattachUI as doReattachUI,
	reattachUIForFile as doReattachUIForFile,
	tryReattachWithRetry as doTryReattachWithRetry,
	executeRecompute,
	type OverlayManagerServices,
	type ReattachDeps,
	setupEventSubscriptions,
	type ToolbarServices,
} from "./coordination";
import type { CommanderActionProvider, OverlayContext } from "./types";

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

		// Set direct click handler for bottom toolbar buttons
		this.bottom.setClickHandler((actionId) => {
			handleActionClick(
				{
					app: this.app,
					getCurrentContext: () => this.currentContext,
					getProviders: () => this.providers,
					getServices: () => this.services,
				},
				actionId,
			);
		});

		// Initialize bottom toolbar
		this.bottom.init();

		// Setup delegated click handler (for edge zones and other elements)
		setupDelegatedClickHandler(this.plugin, {
			app: this.app,
			getCurrentContext: () => this.currentContext,
			getProviders: () => this.providers,
			getServices: () => this.services,
		});

		// Setup event subscriptions
		setupEventSubscriptions(this.app, this.plugin, {
			getContext: () => this.currentContext,
			getServices: () => this.services,
			hideSelectionToolbar: () => this.selection.hide(),
			reattachUI: () => this.reattachUI(),
			reattachUIForFile: (path) => this.reattachUIForFile(path),
			recompute: () => this.recompute(),
			recomputeForFile: (path) => this.recomputeForFile(path),
			scheduleRecompute: () => this.scheduleRecompute(),
			tryReattachWithRetry: (path) => this.tryReattachWithRetry(path),
		});
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
	 * Try to reattach UI with retry mechanism.
	 */
	private tryReattachWithRetry(filePath: string): void {
		doTryReattachWithRetry(this.reattachDeps, filePath, {
			reattachUI: () => this.reattachUI(),
			reattachUIForFile: (p) => this.reattachUIForFile(p),
			recomputeForFile: (p) => this.recomputeForFile(p),
			scheduleRecompute: () => this.scheduleRecompute(),
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
		this.debouncer.destroy();
		this.bottom.detach();
		this.selection.destroy();
		this.layoutCoordinator.detach();
	}
}
