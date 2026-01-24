import { type App, MarkdownView } from "obsidian";
import { getParsedUserSettings } from "../../../global-state/global-state";
import type { RenderedActionConfig } from "../../../managers/actions-manager/types";
import { UserActionKind } from "../../../managers/actions-manager/types";
import { logger } from "../../../utils/logger";

/** Estimated width per button (including gap) */
const BUTTON_WIDTH_ESTIMATE = 90;
/** Minimum buttons to show */
const MIN_VISIBLE_BUTTONS = 2;
/** Fallback max buttons if width unknown */
const DEFAULT_MAX_BUTTONS = 4;

/**
 * @deprecated
 */
export class DeprecatedBottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actionConfigs: RenderedActionConfig[] = [];
	private overflowMenuEl: HTMLElement | null = null;

	constructor(private app: App) {}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public reattach(): void {
		const view = this.getActiveMarkdownView();
		this.reattachToView(view);
	}

	/**
	 * Reattach to view for a specific file path.
	 * Used when getActiveViewOfType fails but we know which file was opened.
	 */
	public reattachForFile(filePath: string): void {
		logger.info(`[BottomToolbar] reattachForFile: ${filePath}`);

		let view = this.getActiveMarkdownView();
		const activeViewPath = view?.file?.path;

		logger.info(
			`[BottomToolbar] activeViewPath: ${activeViewPath ?? "null"}`,
		);

		// Only use active view if it matches expected file path
		if (view?.file?.path !== filePath) {
			logger.info(
				"[BottomToolbar] active view mismatch, searching by path",
			);
			view = this.getMarkdownViewForFile(filePath);
			logger.info(
				`[BottomToolbar] found view by path: ${view?.file?.path ?? "null"}`,
			);
		}

		this.reattachToView(view);
	}

	private reattachToView(view: MarkdownView | null): void {
		logger.info(
			`[BottomToolbar] reattachToView: view=${view?.file?.path ?? "null"}, overlayEl=${!!this.overlayEl}, actionConfigs=${this.actionConfigs.length}`,
		);

		// Always detach and reattach - DOM may have changed even if "same view"
		// See: src/documentaion/insights-about-obsidian-quirks/overlay-navigation-race.md
		this.detach();

		if (!view || !this.overlayEl) {
			logger.info(
				"[BottomToolbar] reattachToView: no view or overlayEl, returning",
			);
			this.attachedView = null;
			return;
		}

		const container = view.contentEl;
		logger.info(
			`[BottomToolbar] reattachToView: container exists=${!!container}`,
		);
		container.addClass("bottom-overlay-host");
		container.appendChild(this.overlayEl);
		container.style.paddingBottom = "64px";

		// Render bottom bar (coordinator will update layout state separately)
		this.renderButtons(this.overlayEl);
		logger.info(
			`[BottomToolbar] reattachToView: buttons rendered, display=${this.overlayEl.style.display}`,
		);

		this.attachedView = view;
	}

	/**
	 * Find MarkdownView for a specific file path by iterating all markdown leaves.
	 */
	private getMarkdownViewForFile(filePath: string): MarkdownView | null {
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === filePath) {
				return view;
			}
		}
		return null;
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
		logger.info(
			`[BottomToolbar] setActions: ${actionConfigs.length} actions`,
		);
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
				a.kind === UserActionKind.NavigatePage ||
				a.kind === UserActionKind.PreviousPage,
		);
		const otherActions = bottomActions.filter(
			(a) =>
				a.kind !== UserActionKind.NavigatePage &&
				a.kind !== UserActionKind.PreviousPage,
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
		b.dataset.action = actionConfig.kind;
		b.className = "my-bottom-overlay-btn";
		b.textContent = actionConfig.label;
		if (actionConfig.disabled) {
			b.disabled = true;
			b.classList.add("is-disabled");
		}
		// Click handling via delegated handler in action-click-dispatcher.ts
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
			item.dataset.action = action.kind;
			item.className = "bottom-overflow-item";
			item.textContent = action.label;
			if (action.disabled) {
				item.disabled = true;
				item.classList.add("is-disabled");
			}
			// Click handling via delegated handler in action-click-dispatcher.ts
			// Close menu after any click
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
