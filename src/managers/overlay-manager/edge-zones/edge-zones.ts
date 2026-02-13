/**
 * Edge zones - full-height clickable navigation zones in editor padding.
 * Only active when there's sufficient padding (readable-line-width mode).
 */

import { type MarkdownView, setIcon } from "obsidian";
import { CommandKind } from "../../obsidian/command-executor";
import type { ActionConfig } from "../bottom-toolbar/types";
import { createLayoutObserver, detectEditorPadding } from "./layout-observer";
import type {
	CreateEdgeZonesOptions,
	EdgeZoneLayoutState,
	EdgeZones,
} from "./types";

/** Inset from edge of workspace-leaf (px) */
const ZONE_INSET = 12;

/**
 * Create edge zones instance for a container.
 */
export function createEdgeZones(options: CreateEdgeZonesOptions): EdgeZones {
	const { container } = options;

	let leftZone: HTMLElement | null = null;
	let rightZone: HTMLElement | null = null;
	let prevAction: ActionConfig | null = null;
	let nextAction: ActionConfig | null = null;
	let attachedView: MarkdownView | null = null;
	let layoutState: EdgeZoneLayoutState = {
		leftZoneActive: false,
		rightZoneActive: false,
	};

	const layoutObserver = createLayoutObserver(() => {
		if (attachedView) {
			calculateAndApplyLayout();
		}
	});

	// ─── Private Functions ───

	function isEditingMode(view: MarkdownView): boolean {
		const mode = view.getMode();
		return mode === "source";
	}

	function calculateAndApplyLayout(): void {
		if (!attachedView) return;

		// Check if view is in editing mode
		if (!isEditingMode(attachedView)) {
			detachZones();
			layoutState = { leftZoneActive: false, rightZoneActive: false };
			return;
		}

		const { padding, leafRect, contentRect } =
			detectEditorPadding(container);
		const containerRect = container.getBoundingClientRect();

		// Calculate zone widths: from leaf edge to ZONE_INSET before content
		let leftZoneWidth = 0;
		let rightZoneWidth = 0;

		if (leafRect && contentRect) {
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
			hasLeftSpace && prevAction !== null && !prevAction.disabled;
		const shouldShowRight =
			hasRightSpace && nextAction !== null && !nextAction.disabled;

		// Update zones with calculated dimensions
		updateZone(
			"left",
			shouldShowLeft,
			leftZoneWidth,
			leafRect,
			containerRect,
		);
		updateZone(
			"right",
			shouldShowRight,
			rightZoneWidth,
			leafRect,
			containerRect,
		);

		layoutState = {
			leftZoneActive: shouldShowLeft,
			rightZoneActive: shouldShowRight,
		};
	}

	function updateZone(
		side: "left" | "right",
		shouldShow: boolean,
		width: number,
		leafRect: DOMRect | null,
		containerRect: DOMRect,
	): void {
		const zone = side === "left" ? leftZone : rightZone;

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
				const newZone = createZone(
					side,
					width,
					leftOffset,
					rightOffset,
				);
				container.appendChild(newZone);
				if (side === "left") {
					leftZone = newZone;
				} else {
					rightZone = newZone;
				}
			}
		} else if (zone) {
			// Hide existing zone
			zone.style.display = "none";
		}
	}

	function createZone(
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
			zone.dataset.action = CommandKind.GoToPrevPage;
		} else {
			zone.style.right = `${rightOffset}px`;
			zone.dataset.action = CommandKind.GoToNextPage;
		}

		// Add icon
		const iconEl = document.createElement("span");
		iconEl.className = "edge-padding-icon";
		setIcon(iconEl, side === "left" ? "chevron-left" : "chevron-right");
		zone.appendChild(iconEl);

		return zone;
	}

	function updateZoneContent(): void {
		if (leftZone) {
			leftZone.dataset.action = prevAction?.id ?? "";
		}
		if (rightZone) {
			rightZone.dataset.action = nextAction?.id ?? "";
		}
	}

	function detachZones(): void {
		leftZone?.remove();
		rightZone?.remove();
		leftZone = null;
		rightZone = null;
	}

	// ─── Public Methods ───

	function attach(containerEl: HTMLElement, view: MarkdownView): void {
		detach();
		attachedView = view;
		layoutObserver.observe(containerEl);
		calculateAndApplyLayout();
	}

	function detach(): void {
		layoutObserver.disconnect();
		detachZones();
		attachedView = null;
		layoutState = { leftZoneActive: false, rightZoneActive: false };
	}

	function setNavActions(navActions: ActionConfig[]): void {
		prevAction =
			navActions.find((a) => a.id === CommandKind.GoToPrevPage) ?? null;
		nextAction =
			navActions.find((a) => a.id === CommandKind.GoToNextPage) ?? null;
		updateZoneContent();

		// Recalculate layout since action availability affects zone visibility
		if (attachedView) {
			calculateAndApplyLayout();
		}
	}

	function getLayoutState(): EdgeZoneLayoutState {
		return { ...layoutState };
	}

	function destroy(): void {
		detach();
	}

	return {
		attach,
		destroy,
		detach,
		getLayoutState,
		setNavActions,
	};
}
