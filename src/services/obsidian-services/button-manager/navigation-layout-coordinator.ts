import type { MarkdownView } from "obsidian";
import { DomSelectors } from "../../../utils/dom-selectors";
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
	 * that coordinates edge zones (now enabled on mobile too).
	 */
	public attach(view: MarkdownView, _isMobile: boolean): void {
		this.detach();

		this.attachedView = view;
		this.container = view.contentEl;

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
	 * Calculates padding, leaf rect, and content rect, updates edge zones.
	 */
	private calculateAndApplyLayout(): void {
		if (!this.container || !this.attachedView) return;

		// Detect available padding, leaf rect, and content rect
		const { padding, leafRect, contentRect } = this.detectEditorPadding(
			this.container,
		);

		// Determine zone visibility based on padding and action availability
		const zoneState = this.edgePaddingNavigator.calculateAndApplyZones(
			this.container,
			this.attachedView,
			padding,
			MIN_PADDING_THRESHOLD,
			leafRect,
			contentRect,
		);

		// Update layout state
		this.layoutState = zoneState;
	}

	/**
	 * Detect available padding by comparing .cm-contentContainer rect to workspace-leaf rect.
	 * Returns content rect and leaf rect for zone positioning.
	 */
	private detectEditorPadding(container: HTMLElement): {
		padding: { left: number; right: number };
		leafRect: DOMRect | null;
		contentRect: DOMRect | null;
	} {
		// Use cm-contentContainer as the content boundary
		const contentEl = container.querySelector(DomSelectors.CM_CONTENT_CONTAINER);
		if (!contentEl) {
			return {
				padding: { left: 0, right: 0 },
				leafRect: null,
				contentRect: null,
			};
		}

		const contentRect = contentEl.getBoundingClientRect();

		// Find workspace-leaf ancestor
		const leafEl = container.closest(DomSelectors.WORKSPACE_LEAF);
		const leafRect = leafEl ? leafEl.getBoundingClientRect() : null;

		// Padding is the space between content and leaf edges
		const padding = leafRect
			? {
					left: Math.max(0, contentRect.left - leafRect.left),
					right: Math.max(0, leafRect.right - contentRect.right),
				}
			: { left: 0, right: 0 };

		return { padding, leafRect, contentRect };
	}
}
