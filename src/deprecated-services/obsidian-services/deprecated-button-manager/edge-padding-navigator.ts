import { type MarkdownView, setIcon } from "obsidian";
import type { RenderedActionConfig } from "../../../managers/actions-manager/types";
import { UserActionKind } from "../../../managers/actions-manager/types";
import type { NavigationLayoutState } from "./navigation-layout-coordinator";

/** Inset from edge of workspace-leaf (px) */
const ZONE_INSET = 12;

/**
 * Manages full-height clickable zones in editor padding for page navigation.
 * Only active when there's sufficient padding (readable-line-width mode).
 *
 * Note: This class no longer manages its own ResizeObserver. Layout decisions
 * are coordinated by NavigationLayoutCoordinator for atomic updates.
 */
export class EdgePaddingNavigator {
	private leftZone: HTMLElement | null = null;
	private rightZone: HTMLElement | null = null;
	private prevAction: RenderedActionConfig | null = null;
	private nextAction: RenderedActionConfig | null = null;
	private container: HTMLElement | null = null;

	/**
	 * Detach zones and cleanup.
	 */
	public detach(): void {
		this.leftZone?.remove();
		this.rightZone?.remove();
		this.leftZone = null;
		this.rightZone = null;
		this.container = null;
	}

	/**
	 * Set navigation actions for the zones.
	 */
	public setActions(actions: RenderedActionConfig[]): void {
		this.prevAction =
			actions.find((a) => a.kind === UserActionKind.PreviousPage) ?? null;
		this.nextAction =
			actions.find((a) => a.kind === UserActionKind.NavigatePage) ?? null;
		this.updateZoneContent();
	}

	/**
	 * Calculate zone visibility and apply changes.
	 * Called by NavigationLayoutCoordinator with pre-calculated padding, leaf rect, and content rect.
	 * Zones extend from workspace-leaf edge to ZONE_INSET (12px) before cm-contentContainer.
	 *
	 * @returns Layout state indicating which zones are active
	 */
	public calculateAndApplyZones(
		container: HTMLElement,
		view: MarkdownView,
		padding: { left: number; right: number },
		minThreshold: number,
		leafRect: DOMRect | null,
		contentRect: DOMRect | null,
	): NavigationLayoutState {
		// Check if view is in editing mode
		if (!this.isEditingMode(view)) {
			this.detach();
			return { leftZoneActive: false, rightZoneActive: false };
		}

		this.container = container;
		const containerRect = container.getBoundingClientRect();

		// Calculate zone widths: from leaf edge to 12px before content
		let leftZoneWidth = 0;
		let rightZoneWidth = 0;

		if (leafRect && contentRect) {
			// Zone extends from leaf edge to ZONE_INSET before content
			leftZoneWidth = Math.max(
				0,
				contentRect.left - leafRect.left - ZONE_INSET,
			);
			rightZoneWidth = Math.max(
				0,
				leafRect.right - contentRect.right - ZONE_INSET,
			);
		} else {
			// Fallback to padding-based calculation
			leftZoneWidth = Math.max(0, padding.left - ZONE_INSET);
			rightZoneWidth = Math.max(0, padding.right - ZONE_INSET);
		}

		// Determine which zones should be visible
		const hasLeftSpace = leftZoneWidth > 0;
		const hasRightSpace = rightZoneWidth > 0;

		const shouldShowLeft =
			hasLeftSpace &&
			this.prevAction !== null &&
			!this.prevAction.disabled;

		const shouldShowRight =
			hasRightSpace &&
			this.nextAction !== null &&
			!this.nextAction.disabled;

		// Update zones with calculated dimensions
		this.updateZone(
			"left",
			shouldShowLeft,
			leftZoneWidth,
			leafRect,
			containerRect,
		);
		this.updateZone(
			"right",
			shouldShowRight,
			rightZoneWidth,
			leafRect,
			containerRect,
		);

		return {
			leftZoneActive: shouldShowLeft,
			rightZoneActive: shouldShowRight,
		};
	}

	/**
	 * Check if view is in editing mode (source or live-preview).
	 */
	private isEditingMode(view: MarkdownView): boolean {
		const mode = view.getMode();
		return mode === "source";
	}

	/**
	 * Update a single zone - create, show, hide, or remove as needed.
	 */
	private updateZone(
		side: "left" | "right",
		shouldShow: boolean,
		width: number,
		leafRect: DOMRect | null,
		containerRect: DOMRect,
	): void {
		const zone = side === "left" ? this.leftZone : this.rightZone;

		if (shouldShow && width > 0) {
			// Calculate position relative to container
			const leftOffset = leafRect
				? leafRect.left - containerRect.left
				: 0;
			const rightOffset = leafRect
				? containerRect.right - leafRect.right
				: 0;

			if (zone) {
				// Update existing zone
				zone.style.display = "";
				zone.style.width = `${width}px`;
				if (side === "left") {
					zone.style.left = `${leftOffset}px`;
				} else {
					zone.style.right = `${rightOffset}px`;
				}
			} else {
				// Create new zone
				const newZone = this.createZone(
					side,
					width,
					leftOffset,
					rightOffset,
				);
				if (this.container) {
					this.container.appendChild(newZone);
				}
				if (side === "left") {
					this.leftZone = newZone;
				} else {
					this.rightZone = newZone;
				}
			}
		} else if (zone) {
			// Hide existing zone
			zone.style.display = "none";
		}
	}

	/**
	 * Create a single zone element.
	 * Left zone: positioned at leaf left edge (relative to container)
	 * Right zone: positioned at leaf right edge (relative to container)
	 */
	private createZone(
		side: "left" | "right",
		width: number,
		leftOffset: number,
		rightOffset: number,
	): HTMLElement {
		const zone = document.createElement("div");
		zone.className = `edge-padding-zone edge-padding-zone-${side}`;
		zone.style.width = `${width}px`;

		if (side === "left") {
			zone.style.left = `${leftOffset}px`;
			zone.dataset.action = this.prevAction?.kind ?? "";
		} else {
			zone.style.right = `${rightOffset}px`;
			zone.dataset.action = this.nextAction?.kind ?? "";
		}

		// Add icon
		const iconEl = document.createElement("span");
		iconEl.className = "edge-padding-icon";
		setIcon(iconEl, side === "left" ? "chevron-left" : "chevron-right");
		zone.appendChild(iconEl);

		return zone;
	}

	/**
	 * Update zone content when actions change.
	 */
	private updateZoneContent(): void {
		if (this.leftZone) {
			this.leftZone.dataset.action = this.prevAction?.kind ?? "";
		}
		if (this.rightZone) {
			this.rightZone.dataset.action = this.nextAction?.kind ?? "";
		}
	}
}
