import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import { ACTION_CONFIGS } from "../../wip-configs/actions/actions-config";
import type { UserAction } from "../../wip-configs/actions/types";
import type { ApiService } from "../atomic-services/api-service";
import type { SelectionService } from "../atomic-services/selection-service";
import { BottomToolbarService } from "./bottom-toolbar";
import { ButtonRegistry } from "./button-registry";
import { AboveSelectionToolbarService } from "./selection-toolbar";

export type ButtonManagerServices = {
	apiService: ApiService;
	selectionService: SelectionService;
	vaultActionManager: VaultActionManager;
};

/**
 * Central manager for all button/toolbar functionality.
 * Encapsulates ButtonRegistry + both toolbar services.
 * Self-contained: init once, runs autonomously.
 */
export class ButtonManager {
	private registry: ButtonRegistry;
	private bottom: BottomToolbarService;
	private selection: AboveSelectionToolbarService;
	private services: ButtonManagerServices | null = null;

	constructor(
		private app: App,
		private plugin: Plugin,
	) {
		this.registry = new ButtonRegistry(this.app);
		this.bottom = new BottomToolbarService(this.app);
		this.selection = new AboveSelectionToolbarService(this.app);
	}

	/**
	 * Initialize with services and wire up all event subscriptions.
	 * Call this once after plugin services are ready.
	 */
	public init(services: ButtonManagerServices): void {
		this.services = services;

		// Initialize bottom toolbar
		this.bottom.init();

		// Wire registry → toolbar subscriptions
		this.registry.subscribeBottom((actions) => {
			this.bottom.setActions(actions);
		});
		this.registry.subscribeSelection((actions) => {
			this.selection.setActions(actions);
		});

		// Setup delegated click handler for button actions
		this.setupButtonClickHandlers();

		// Initial recompute on layout ready
		this.app.workspace.onLayoutReady(async () => {
			await this.registry.recompute();
			this.selection.reattach();
			this.bottom.reattach();
		});

		// Reattach when user switches panes/notes
		this.plugin.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				(_leaf: WorkspaceLeaf) => {
					this.registry.scheduleRecompute();
					this.selection.reattach();
					this.bottom.reattach();
				},
			),
		);

		// Show selection toolbar after drag
		this.plugin.registerDomEvent(document, "dragend", async () => {
			await this.registry.recompute();
			this.selection.reattach();
		});

		// Show selection toolbar after mouse selection
		this.plugin.registerDomEvent(document, "mouseup", async () => {
			await this.registry.recompute();
			this.selection.reattach();
		});

		// Show selection toolbar after keyboard selection
		this.plugin.registerDomEvent(
			document,
			"keyup",
			async (evt: KeyboardEvent) => {
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
					await this.registry.recompute();
					this.selection.reattach();
				}
			},
		);

		// Re-check after major layout changes (splits, etc.)
		this.plugin.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.registry.scheduleRecompute();
				this.selection.reattach();
				this.bottom.reattach();
			}),
		);

		// Handle CSS changes
		this.plugin.registerEvent(
			this.app.workspace.on("css-change", () =>
				this.selection.onCssChange(),
			),
		);
	}

	/**
	 * Setup delegated click handlers for toolbar buttons.
	 */
	private setupButtonClickHandlers(): void {
		this.plugin.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			// Match both buttons and edge zone divs with data-action
			const button = target.closest(
				"[data-action]",
			) as HTMLElement | null;
			if (!button) return;

			const actionId = button.dataset.action as UserAction;
			if (!actionId) return;

			const config = ACTION_CONFIGS[actionId];
			if (!config) return;

			if (!this.services) return;

			// Execute the action with services
			config.execute({
				apiService: this.services.apiService,
				app: this.app,
				selectionService: this.services.selectionService,
				vaultActionManager: this.services.vaultActionManager,
			});
		});
	}

	/**
	 * Cleanup - detach both toolbars.
	 */
	public destroy(): void {
		this.bottom.detach();
		this.selection.detach();
	}
}
