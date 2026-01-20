import { type App, MarkdownView } from "obsidian";
import {
	type RenderedActionConfig,
	UserAction,
} from "../../wip-configs/actions/types";
import type { NavigationLayoutState } from "./navigation-layout-coordinator";

/** Estimated width per button (including gap) */
const BUTTON_WIDTH_ESTIMATE = 90;
/** Minimum buttons to show */
const MIN_VISIBLE_BUTTONS = 2;
/** Fallback max buttons if width unknown */
const DEFAULT_MAX_BUTTONS = 4;

export class BottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actionConfigs: RenderedActionConfig[] = [];
	private overflowMenuEl: HTMLElement | null = null;
	private layoutState: NavigationLayoutState = {
		leftZoneActive: false,
		rightZoneActive: false,
	};

	constructor(private app: App) {}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public reattach(): void {
		const view = this.getActiveMarkdownView();
		if (
			view &&
			this.attachedView === view &&
			this.overlayEl?.isConnected &&
			this.overlayEl.parentElement === view.contentEl
		)
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

		// Render bottom bar (coordinator will update layout state separately)
		this.renderButtons(this.overlayEl);

		this.attachedView = view;
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

	public setActions(actionConfigs: RenderedActionConfig[]): void {
		this.actionConfigs = actionConfigs;
		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	/**
	 * Update layout state from NavigationLayoutCoordinator.
	 * Triggers re-render to show/hide nav buttons based on zone visibility.
	 */
	public updateLayoutState(state: NavigationLayoutState): void {
		this.layoutState = state;
		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	public isMobile(): boolean {
		// biome-ignore lint/suspicious/noExplicitAny: <isMobile exists but not in types>
		return (this.app as any).isMobile ?? false;
	}

	private renderButtons(host: HTMLElement): void {
		while (host.firstChild) host.removeChild(host.firstChild);

		// Filter out nav actions that are handled by edge zones
		// PreviousPage → left zone, NavigatePage → right zone
		const bottomActions = this.actionConfigs.filter((a) => {
			if (a.id === UserAction.PreviousPage && this.layoutState.leftZoneActive) {
				return false;
			}
			if (a.id === UserAction.NavigatePage && this.layoutState.rightZoneActive) {
				return false;
			}
			return true;
		});

		// Hide toolbar when no actions available
		if (bottomActions.length === 0) {
			host.style.display = "none";
			// Clear padding when hidden
			if (host.parentElement) {
				host.parentElement.style.paddingBottom = "";
			}
			return;
		}
		host.style.display = "";
		// Restore padding when shown
		if (host.parentElement) {
			host.parentElement.style.paddingBottom = "64px";
		}

		// Calculate max visible buttons based on container width
		const containerWidth = host.parentElement?.clientWidth ?? 0;
		const maxButtons =
			containerWidth > 0
				? Math.max(
						MIN_VISIBLE_BUTTONS,
						Math.floor(containerWidth / BUTTON_WIDTH_ESTIMATE),
					)
				: DEFAULT_MAX_BUTTONS;

		// Determine visible vs overflow actions
		const visibleActions = bottomActions.slice(0, maxButtons);
		const overflowActions = bottomActions.slice(maxButtons);

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

	private createButton(
		actionConfig: RenderedActionConfig,
	): HTMLButtonElement {
		const b = document.createElement("button");
		b.dataset.action = actionConfig.id;
		b.className = "my-bottom-overlay-btn";
		b.textContent = actionConfig.label;
		if (actionConfig.disabled) {
			b.disabled = true;
			b.classList.add("is-disabled");
		}
		return b;
	}

	/**
	 * Toggle overflow menu visibility.
	 */
	private toggleOverflowMenu(
		actions: RenderedActionConfig[],
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
			if (action.disabled) {
				item.disabled = true;
				item.classList.add("is-disabled");
			}
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
