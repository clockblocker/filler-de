import { type App, MarkdownView } from "obsidian";
import {
	type AnyActionConfig,
	UserAction,
} from "../../wip-configs/actions/types";

/** Max buttons in bottom bar before overflow */
const MAX_VISIBLE_BUTTONS = 4;

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
	private leftEdgeEl: HTMLElement | null = null;
	private rightEdgeEl: HTMLElement | null = null;

	constructor(private app: App) {}

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

		// Add edge buttons on desktop
		if (!this.isMobile()) {
			this.attachEdgeButtons(container);
		}

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

		// Detach edge buttons
		this.leftEdgeEl?.remove();
		this.rightEdgeEl?.remove();
		this.leftEdgeEl = null;
		this.rightEdgeEl = null;

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
		if (this.overlayEl) this.renderButtons(this.overlayEl);
		// Re-render edge buttons if attached
		if (this.attachedView && !this.isMobile()) {
			this.updateEdgeButtons();
		}
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

		// On desktop, edge actions go to side buttons, not bottom bar
		const bottomActions = this.isMobile()
			? this.actionConfigs
			: this.actionConfigs.filter((a) => !EDGE_BUTTON_ACTIONS.has(a.id));

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

	/**
	 * Attach edge buttons for navigation (desktop only).
	 */
	private attachEdgeButtons(container: HTMLElement): void {
		const edgeActions = this.actionConfigs.filter((a) =>
			EDGE_BUTTON_ACTIONS.has(a.id),
		);
		if (edgeActions.length === 0) return;

		const prevAction = edgeActions.find(
			(a) => a.id === UserAction.PreviousPage,
		);
		const nextAction = edgeActions.find(
			(a) => a.id === UserAction.NavigatePage,
		);

		// Create left edge button (previous)
		if (prevAction) {
			this.leftEdgeEl = this.createEdgeButton(prevAction, "left");
			container.appendChild(this.leftEdgeEl);
		}

		// Create right edge button (next)
		if (nextAction) {
			this.rightEdgeEl = this.createEdgeButton(nextAction, "right");
			container.appendChild(this.rightEdgeEl);
		}
	}

	private createEdgeButton(
		action: AnyActionConfig,
		side: "left" | "right",
	): HTMLElement {
		const btn = document.createElement("button");
		btn.dataset.action = action.id;
		btn.className = `edge-nav-btn edge-nav-${side}`;
		btn.textContent = action.label;
		btn.title =
			action.id === UserAction.PreviousPage
				? "Previous page"
				: "Next page";
		return btn;
	}

	private updateEdgeButtons(): void {
		if (!this.attachedView) return;

		// Remove existing edge buttons
		this.leftEdgeEl?.remove();
		this.rightEdgeEl?.remove();
		this.leftEdgeEl = null;
		this.rightEdgeEl = null;

		// Re-attach with current actions
		this.attachEdgeButtons(this.attachedView.contentEl);
	}
}
