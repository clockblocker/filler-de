import { type App, MarkdownView } from "obsidian";
import {
	type AnyActionConfig,
	UserAction,
} from "../../wip-configs/actions/types";
import { EdgePaddingNavigator } from "./edge-padding-navigator";

/** Estimated width per button (including gap) */
const BUTTON_WIDTH_ESTIMATE = 90;
/** Minimum buttons to show */
const MIN_VISIBLE_BUTTONS = 2;
/** Fallback max buttons if width unknown */
const DEFAULT_MAX_BUTTONS = 4;

/** Navigation actions that can appear as edge buttons */
const EDGE_BUTTON_ACTIONS = new Set<string>([
	UserAction.PreviousPage,
	UserAction.NavigatePage,
]);

export class BottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actionConfigs: AnyActionConfig[] = [];
	private overflowMenuEl: HTMLElement | null = null;
	private edgePaddingNavigator: EdgePaddingNavigator;
	private useZoneNavigation = false;
	private resizeObserver: ResizeObserver | null = null;

	constructor(private app: App) {
		this.edgePaddingNavigator = new EdgePaddingNavigator();
	}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public reattach(): void {
		const view = this.getActiveMarkdownView();
		if (view && this.attachedView === view && this.overlayEl?.isConnected)
			return;

		this.detach();

		if (!view || !this.overlayEl) {
			this.attachedView = null;
			return;
		}

		const container = view.contentEl;
		container.addClass("bottom-overlay-host");
		container.appendChild(this.overlayEl);
		container.style.paddingBottom = "64px";

		// Try padding zones first on desktop
		if (!this.isMobile()) {
			this.edgePaddingNavigator.setActions(this.actionConfigs);
			this.useZoneNavigation = this.edgePaddingNavigator.reattach(view);
			// If zones not active, edge actions go to bottom bar (handled by renderButtons)
		}

		// Re-render bottom bar (includes/excludes edge actions based on zone state)
		this.renderButtons(this.overlayEl);

		// Setup resize observer to re-render on width changes
		this.setupResizeObserver(container);

		this.attachedView = view;
	}

	private setupResizeObserver(container: HTMLElement): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = new ResizeObserver(() => {
			if (this.overlayEl) this.renderButtons(this.overlayEl);
		});
		this.resizeObserver.observe(container);
	}

	public detach(): void {
		if (!this.overlayEl) return;

		if (this.attachedView) {
			const oldHost = this.attachedView.contentEl;
			oldHost.style.paddingBottom = "";
			oldHost.removeClass("bottom-overlay-host");
		}

		if (this.overlayEl.parentElement) {
			this.overlayEl.parentElement.removeChild(this.overlayEl);
		}

		// Detach padding zones
		this.edgePaddingNavigator.detach();
		this.useZoneNavigation = false;

		// Disconnect resize observer
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;

		// Hide overflow menu
		this.hideOverflowMenu();

		this.attachedView = null;
	}

	private createOverlay(): HTMLElement {
		const el = document.createElement("div");
		el.className = "my-bottom-overlay";
		this.renderButtons(el);
		document.body.classList.add("hide-status-bar");
		return el;
	}

	public setActions(actionConfigs: AnyActionConfig[]): void {
		this.actionConfigs = actionConfigs;

		// Update padding zones if attached
		if (this.attachedView && !this.isMobile()) {
			this.edgePaddingNavigator.setActions(actionConfigs);
		}

		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private isMobile(): boolean {
		// biome-ignore lint/suspicious/noExplicitAny: <isMobile exists but not in types>
		return (this.app as any).isMobile ?? false;
	}

	private renderButtons(host: HTMLElement): void {
		while (host.firstChild) host.removeChild(host.firstChild);

		// On desktop with zone navigation, edge actions handled by zones
		// On desktop without zones OR on mobile, include edge actions in bottom bar
		const excludeEdgeActions = !this.isMobile() && this.useZoneNavigation;
		const bottomActions = excludeEdgeActions
			? this.actionConfigs.filter((a) => !EDGE_BUTTON_ACTIONS.has(a.id))
			: this.actionConfigs;

		// Hide toolbar when no actions available
		if (bottomActions.length === 0) {
			host.style.display = "none";
			return;
		}
		host.style.display = "";

		// Determine visible vs overflow actions
		const visibleActions = bottomActions.slice(0, MAX_VISIBLE_BUTTONS);
		const overflowActions = bottomActions.slice(MAX_VISIBLE_BUTTONS);

		// Render visible buttons
		for (const actionConfig of visibleActions) {
			host.appendChild(this.createButton(actionConfig));
		}

		// Add overflow button if needed
		if (overflowActions.length > 0) {
			const overflowBtn = document.createElement("button");
			overflowBtn.className = "my-bottom-overlay-btn overflow-btn";
			overflowBtn.textContent = "⋯";
			overflowBtn.title = "More actions";
			overflowBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleOverflowMenu(overflowActions, overflowBtn);
			});
			host.appendChild(overflowBtn);
		}
	}

	private createButton(actionConfig: AnyActionConfig): HTMLButtonElement {
		const b = document.createElement("button");
		b.dataset.action = actionConfig.id;
		b.className = "my-bottom-overlay-btn";
		b.textContent = actionConfig.label;
		return b;
	}

	/**
	 * Toggle overflow menu visibility.
	 */
	private toggleOverflowMenu(
		actions: AnyActionConfig[],
		anchorBtn: HTMLElement,
	): void {
		if (this.overflowMenuEl) {
			this.hideOverflowMenu();
			return;
		}

		// Create overflow menu
		const menu = document.createElement("div");
		menu.className = "bottom-overflow-menu";

		for (const action of actions) {
			const item = document.createElement("button");
			item.dataset.action = action.id;
			item.className = "bottom-overflow-item";
			item.textContent = action.label;
			item.addEventListener("click", () => this.hideOverflowMenu());
			menu.appendChild(item);
		}

		// Position above anchor button
		const rect = anchorBtn.getBoundingClientRect();
		menu.style.position = "fixed";
		menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
		menu.style.right = `${window.innerWidth - rect.right}px`;

		document.body.appendChild(menu);
		this.overflowMenuEl = menu;

		// Close on click outside
		const closeHandler = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node) && e.target !== anchorBtn) {
				this.hideOverflowMenu();
				document.removeEventListener("click", closeHandler);
			}
		};
		setTimeout(() => document.addEventListener("click", closeHandler), 0);
	}

	private hideOverflowMenu(): void {
		this.overflowMenuEl?.remove();
		this.overflowMenuEl = null;
	}
}
