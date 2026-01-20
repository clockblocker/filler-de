import type { MarkdownView } from "obsidian";
import type { RenderedActionConfig } from "../../wip-configs/actions/types";
import { UserAction } from "../../wip-configs/actions/types";
import type { NavigationLayoutState } from "./navigation-layout-coordinator";

/** Maximum zone width on ultra-wide displays (px) */
const MAX_ZONE_WIDTH = 120;

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
			actions.find((a) => a.id === UserAction.PreviousPage) ?? null;
		this.nextAction =
			actions.find((a) => a.id === UserAction.NavigatePage) ?? null;
		this.updateZoneContent();
	}

	/**
	 * Calculate zone visibility and apply changes.
	 * Called by NavigationLayoutCoordinator with pre-calculated padding.
	 *
	 * @returns Layout state indicating which zones are active
	 */
	public calculateAndApplyZones(
		container: HTMLElement,
		view: MarkdownView,
		padding: { left: number; right: number },
		minThreshold: number,
	): NavigationLayoutState {
		// Check if view is in editing mode
		if (!this.isEditingMode(view)) {
			this.detach();
			return { leftZoneActive: false, rightZoneActive: false };
		}

		this.container = container;

		// Determine which zones should be visible
		const shouldShowLeft =
			padding.left >= minThreshold &&
			this.prevAction !== null &&
			!this.prevAction.disabled;

		const shouldShowRight =
			padding.right >= minThreshold &&
			this.nextAction !== null &&
			!this.nextAction.disabled;

		// Update left zone
		this.updateZone("left", shouldShowLeft, padding.left);

		// Update right zone
		this.updateZone("right", shouldShowRight, padding.right);

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
	): void {
		const zone = side === "left" ? this.leftZone : this.rightZone;

		if (shouldShow) {
			if (zone) {
				// Update existing zone
				zone.style.display = "";
				const clampedWidth = Math.min(width, MAX_ZONE_WIDTH);
				zone.style.width = `${clampedWidth}px`;
			} else {
				// Create new zone
				const newZone = this.createZone(side, width);
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
	 */
	private createZone(side: "left" | "right", width: number): HTMLElement {
		const zone = document.createElement("div");
		zone.className = `edge-padding-zone edge-padding-zone-${side}`;
		const clampedWidth = Math.min(width, MAX_ZONE_WIDTH);
		zone.style.width = `${clampedWidth}px`;

		if (side === "left") {
			zone.style.left = "0";
			zone.dataset.action = this.prevAction?.id ?? "";
		} else {
			zone.style.right = "0";
			zone.dataset.action = this.nextAction?.id ?? "";
		}

		// Add icon
		const icon = document.createElement("span");
		icon.className = "edge-padding-icon";
		icon.textContent = side === "left" ? "<" : ">";
		zone.appendChild(icon);

		return zone;
	}

	/**
	 * Update zone content when actions change.
	 */
	private updateZoneContent(): void {
		if (this.leftZone) {
			this.leftZone.dataset.action = this.prevAction?.id ?? "";
		}
		if (this.rightZone) {
			this.rightZone.dataset.action = this.nextAction?.id ?? "";
		}
	}
}
