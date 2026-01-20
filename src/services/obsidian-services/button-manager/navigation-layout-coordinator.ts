import type { MarkdownView } from "obsidian";
import type { RenderedActionConfig } from "../../wip-configs/actions/types";
import type { BottomToolbarService } from "./bottom-toolbar";
import type { EdgePaddingNavigator } from "./edge-padding-navigator";

/** Minimum padding width to show edge zones (px) */
const MIN_PADDING_THRESHOLD = 60;

export interface NavigationLayoutState {
	leftZoneActive: boolean;
	rightZoneActive: boolean;
}

/**
 * Unified controller that coordinates navigation between edge zones and bottom toolbar.
 * Single ResizeObserver ensures atomic layout decisions without race conditions.
 */
export class NavigationLayoutCoordinator {
	private resizeObserver: ResizeObserver | null = null;
	private container: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private layoutState: NavigationLayoutState = {
		leftZoneActive: false,
		rightZoneActive: false,
	};

	constructor(
		private edgePaddingNavigator: EdgePaddingNavigator,
		private bottomToolbar: BottomToolbarService,
	) {}

	/**
	 * Attach coordinator to a view. Sets up single ResizeObserver
	 * that coordinates both edge zones and bottom toolbar.
	 */
	public attach(view: MarkdownView, isMobile: boolean): void {
		this.detach();

		this.attachedView = view;
		this.container = view.contentEl;

		// On mobile, skip edge zones entirely
		if (isMobile) {
			this.layoutState = { leftZoneActive: false, rightZoneActive: false };
			this.edgePaddingNavigator.detach();
			this.bottomToolbar.updateLayoutState(this.layoutState);
			return;
		}

		// Initial layout calculation
		this.calculateAndApplyLayout();

		// Single ResizeObserver for both components
		this.setupResizeObserver();
	}

	/**
	 * Detach coordinator and cleanup.
	 */
	public detach(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.edgePaddingNavigator.detach();
		this.layoutState = { leftZoneActive: false, rightZoneActive: false };
		this.container = null;
		this.attachedView = null;
	}

	/**
	 * Update actions for both components.
	 */
	public setActions(actions: RenderedActionConfig[]): void {
		this.edgePaddingNavigator.setActions(actions);
		// Recalculate layout since action availability affects zone visibility
		if (this.container && this.attachedView) {
			this.calculateAndApplyLayout();
		}
	}

	/**
	 * Get current layout state.
	 */
	public getLayoutState(): NavigationLayoutState {
		return { ...this.layoutState };
	}

	private setupResizeObserver(): void {
		if (!this.container) return;

		this.resizeObserver = new ResizeObserver(() => {
			// Use requestAnimationFrame to ensure layout is stable
			requestAnimationFrame(() => {
				this.calculateAndApplyLayout();
			});
		});
		this.resizeObserver.observe(this.container);
	}

	/**
	 * Core layout calculation - single source of truth.
	 * Calculates padding, updates edge zones, notifies bottom toolbar atomically.
	 */
	private calculateAndApplyLayout(): void {
		if (!this.container || !this.attachedView) return;

		// Detect available padding
		const padding = this.detectEditorPadding(this.container);

		// Determine zone visibility based on padding and action availability
		const zoneState = this.edgePaddingNavigator.calculateAndApplyZones(
			this.container,
			this.attachedView,
			padding,
			MIN_PADDING_THRESHOLD,
		);

		// Update layout state
		this.layoutState = zoneState;

		// Notify bottom toolbar to re-render with correct exclusions
		this.bottomToolbar.updateLayoutState(this.layoutState);
	}

	/**
	 * Detect available padding by comparing .cm-sizer rect to container rect.
	 */
	private detectEditorPadding(container: HTMLElement): {
		left: number;
		right: number;
	} {
		const sizer = container.querySelector(".cm-sizer");
		if (!sizer) {
			return { left: 0, right: 0 };
		}

		const containerRect = container.getBoundingClientRect();
		const sizerRect = sizer.getBoundingClientRect();

		return {
			left: Math.max(0, sizerRect.left - containerRect.left),
			right: Math.max(0, containerRect.right - sizerRect.right),
		};
	}
}
