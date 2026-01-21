import { type App, MarkdownView } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import { logger } from "../../../utils/logger";
import type { RenderedActionConfig } from "../../wip-configs/actions/types";
import { UserAction } from "../../wip-configs/actions/types";

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
	private clickHandler: ((actionId: string) => void) | null = null;

	constructor(private app: App) {}

	/**
	 * Set click handler for button actions.
	 * Called by ButtonManager to inject action execution logic.
	 */
	public setClickHandler(handler: (actionId: string) => void): void {
		logger.info("[BottomToolbar] setClickHandler called");
		this.clickHandler = handler;
	}

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

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	public isMobile(): boolean {
		// biome-ignore lint/suspicious/noExplicitAny: <isMobile exists but not in types>
		return (this.app as any).isMobile ?? false;
	}

	private renderButtons(host: HTMLElement): void {
		while (host.firstChild) host.removeChild(host.firstChild);

		const bottomActions = this.actionConfigs;

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

		// Split actions into nav vs non-nav
		const navActions = bottomActions.filter(
			(a) =>
				a.id === UserAction.NavigatePage ||
				a.id === UserAction.PreviousPage,
		);
		const otherActions = bottomActions.filter(
			(a) =>
				a.id !== UserAction.NavigatePage &&
				a.id !== UserAction.PreviousPage,
		);

		// Get position setting
		const navPosition =
			getParsedUserSettings().navButtonsPosition ?? "left";

		// Determine order based on position
		const leftGroup = navPosition === "left" ? navActions : otherActions;
		const rightGroup = navPosition === "left" ? otherActions : navActions;

		// Calculate max visible buttons based on container width
		const containerWidth = host.parentElement?.clientWidth ?? 0;
		const maxButtons =
			containerWidth > 0
				? Math.max(
						MIN_VISIBLE_BUTTONS,
						Math.floor(containerWidth / BUTTON_WIDTH_ESTIMATE),
					)
				: DEFAULT_MAX_BUTTONS;

		// Account for separator in max buttons calculation
		const hasSeparator = leftGroup.length > 0 && rightGroup.length > 0;
		const effectiveMaxButtons = hasSeparator ? maxButtons - 1 : maxButtons;

		// Combine groups for overflow calculation
		const allOrdered = [...leftGroup, ...rightGroup];
		const visibleCount = Math.min(allOrdered.length, effectiveMaxButtons);
		const overflowActions = allOrdered.slice(visibleCount);

		// Render left group buttons
		const visibleLeftCount = Math.min(leftGroup.length, visibleCount);
		for (let i = 0; i < visibleLeftCount; i++) {
			host.appendChild(this.createButton(leftGroup[i]));
		}

		// Add separator if both groups have visible buttons
		const remainingSlots = visibleCount - visibleLeftCount;
		if (
			visibleLeftCount > 0 &&
			remainingSlots > 0 &&
			rightGroup.length > 0
		) {
			const separator = document.createElement("span");
			separator.className = "bottom-toolbar-separator";
			separator.textContent = "|";
			host.appendChild(separator);
		}

		// Render right group buttons
		const visibleRightCount = Math.min(rightGroup.length, remainingSlots);
		for (let i = 0; i < visibleRightCount; i++) {
			host.appendChild(this.createButton(rightGroup[i]));
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
		logger.info(
			`[BottomToolbar] createButton: id=${actionConfig.id}, disabled=${actionConfig.disabled}, hasHandler=${!!this.clickHandler}`,
		);
		if (actionConfig.disabled) {
			b.disabled = true;
			b.classList.add("is-disabled");
		} else if (this.clickHandler) {
			// Direct click handler for non-disabled buttons
			// (delegated handler doesn't work reliably for button elements)
			const handler = this.clickHandler;
			b.addEventListener("click", () => {
				logger.info(
					`[BottomToolbar] Button CLICKED: ${actionConfig.id}`,
				);
				handler(actionConfig.id);
			});
		} else {
			logger.warn(
				`[BottomToolbar] No clickHandler when creating button: ${actionConfig.id}`,
			);
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
			} else if (this.clickHandler) {
				// Direct click handler for non-disabled buttons
				item.addEventListener("click", () => {
					this.clickHandler?.(action.id);
					this.hideOverflowMenu();
				});
			} else {
				item.addEventListener("click", () => this.hideOverflowMenu());
			}
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
