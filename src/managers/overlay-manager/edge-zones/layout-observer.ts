/**
 * Layout observer for edge zones - detects editor padding for zone positioning.
 */

import { DomSelectors } from "../../../utils/dom-selectors";
import type { PaddingDetectionResult } from "./types";

/**
 * Detect available padding by comparing .cm-contentContainer rect to workspace-leaf rect.
 * Returns content rect and leaf rect for zone positioning.
 */
export function detectEditorPadding(
	container: HTMLElement,
): PaddingDetectionResult {
	// Use cm-contentContainer as the content boundary
	const contentEl = container.querySelector(DomSelectors.CM_CONTENT_CONTAINER);
	if (!contentEl) {
		return {
			contentRect: null,
			leafRect: null,
			padding: { left: 0, right: 0 },
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

	return { contentRect, leafRect, padding };
}

/**
 * Layout observer that wraps ResizeObserver with rAF debounce.
 */
export type LayoutObserver = {
	/** Start observing the container */
	observe(container: HTMLElement): void;
	/** Stop observing */
	disconnect(): void;
};

/**
 * Create a layout observer with rAF-debounced callbacks.
 */
export function createLayoutObserver(
	onLayoutChange: (container: HTMLElement) => void,
): LayoutObserver {
	let resizeObserver: ResizeObserver | null = null;
	let rafId: number | null = null;
	let currentContainer: HTMLElement | null = null;

	function observe(container: HTMLElement): void {
		disconnect();
		currentContainer = container;

		resizeObserver = new ResizeObserver(() => {
			// Debounce with requestAnimationFrame
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (currentContainer) {
					onLayoutChange(currentContainer);
				}
			});
		});

		resizeObserver.observe(container);
	}

	function disconnect(): void {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		resizeObserver?.disconnect();
		resizeObserver = null;
		currentContainer = null;
	}

	return { disconnect, observe };
}
