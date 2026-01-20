import type { MarkdownView } from "obsidian";
import type { AnyActionConfig } from "../../wip-configs/actions/types";
import { UserAction } from "../../wip-configs/actions/types";

/** Minimum padding width to show edge zones (px) */
const MIN_PADDING_THRESHOLD = 60;

/** Maximum zone width on ultra-wide displays (px) */
const MAX_ZONE_WIDTH = 120;

/**
 * Manages full-height clickable zones in editor padding for page navigation.
 * Only active when there's sufficient padding (readable-line-width mode).
 */
export class EdgePaddingNavigator {
	private leftZone: HTMLElement | null = null;
	private rightZone: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private prevAction: AnyActionConfig | null = null;
	private nextAction: AnyActionConfig | null = null;
	private active = false;

	/**
	 * Initialize the navigator (creates ResizeObserver).
	 */
	public init(): void {
		// ResizeObserver created on attach
	}

	/**
	 * Attach zones to the given view if in editing mode with sufficient padding.
	 * @returns true if zones are active, false if fallback needed
	 */
	public reattach(view: MarkdownView): boolean {
		this.detach();

		if (!this.isEditingMode(view)) {
			this.active = false;
			return false;
		}

		const container = view.contentEl;
		const padding = this.detectEditorPadding(container);

		if (
			padding.left < MIN_PADDING_THRESHOLD &&
			padding.right < MIN_PADDING_THRESHOLD
		) {
			this.active = false;
			return false;
		}

		this.createZones(container, padding);
		this.setupResizeObserver(container);
		this.active = true;
		return true;
	}

	/**
	 * Detach zones and cleanup.
	 */
	public detach(): void {
		this.leftZone?.remove();
		this.rightZone?.remove();
		this.leftZone = null;
		this.rightZone = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.active = false;
	}

	/**
	 * Check if zones are currently active.
	 */
	public isActive(): boolean {
		return this.active;
	}

	/**
	 * Set navigation actions for the zones.
	 */
	public setActions(actions: AnyActionConfig[]): void {
		this.prevAction =
			actions.find((a) => a.id === UserAction.PreviousPage) ?? null;
		this.nextAction =
			actions.find((a) => a.id === UserAction.NavigatePage) ?? null;
		this.updateZoneContent();
	}

	/**
	 * Check if view is in editing mode (source or live-preview).
	 */
	private isEditingMode(view: MarkdownView): boolean {
		const mode = view.getMode();
		return mode === "source";
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

	/**
	 * Create left and right zones in the container.
	 */
	private createZones(
		container: HTMLElement,
		padding: { left: number; right: number },
	): void {
		if (padding.left >= MIN_PADDING_THRESHOLD && this.prevAction) {
			this.leftZone = this.createZone("left", padding.left);
			container.appendChild(this.leftZone);
		}

		if (padding.right >= MIN_PADDING_THRESHOLD && this.nextAction) {
			this.rightZone = this.createZone("right", padding.right);
			container.appendChild(this.rightZone);
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

	/**
	 * Setup ResizeObserver to recalculate zones on resize.
	 */
	private setupResizeObserver(container: HTMLElement): void {
		this.resizeObserver = new ResizeObserver(() => {
			this.recalculateZones(container);
		});
		this.resizeObserver.observe(container);
	}

	/**
	 * Recalculate zone widths on resize.
	 */
	private recalculateZones(container: HTMLElement): void {
		const padding = this.detectEditorPadding(container);

		// Update left zone
		if (this.leftZone) {
			if (padding.left < MIN_PADDING_THRESHOLD) {
				this.leftZone.style.display = "none";
			} else {
				this.leftZone.style.display = "";
				const clampedWidth = Math.min(padding.left, MAX_ZONE_WIDTH);
				this.leftZone.style.width = `${clampedWidth}px`;
			}
		} else if (padding.left >= MIN_PADDING_THRESHOLD && this.prevAction) {
			this.leftZone = this.createZone("left", padding.left);
			container.appendChild(this.leftZone);
		}

		// Update right zone
		if (this.rightZone) {
			if (padding.right < MIN_PADDING_THRESHOLD) {
				this.rightZone.style.display = "none";
			} else {
				this.rightZone.style.display = "";
				const clampedWidth = Math.min(padding.right, MAX_ZONE_WIDTH);
				this.rightZone.style.width = `${clampedWidth}px`;
			}
		} else if (padding.right >= MIN_PADDING_THRESHOLD && this.nextAction) {
			this.rightZone = this.createZone("right", padding.right);
			container.appendChild(this.rightZone);
		}

		// Update active status based on zone visibility
		const leftVisible =
			this.leftZone && this.leftZone.style.display !== "none";
		const rightVisible =
			this.rightZone && this.rightZone.style.display !== "none";
		this.active = Boolean(leftVisible || rightVisible);
	}
}
