/**
 * Types for edge padding navigation zones.
 */

import type { MarkdownView } from "obsidian";
import type { ActionConfig } from "../bottom-toolbar";

/**
 * Layout state indicating which edge zones are active.
 */
export type EdgeZoneLayoutState = {
	leftZoneActive: boolean;
	rightZoneActive: boolean;
};

/**
 * Edge zones interface - manages clickable navigation zones in editor padding.
 */
export interface EdgeZones {
	/** Attach zones to container and start observing layout changes */
	attach(container: HTMLElement, view: MarkdownView): void;
	/** Detach zones and stop observing */
	detach(): void;
	/** Set navigation actions for the zones */
	setNavActions(navActions: ActionConfig[]): void;
	/** Get current layout state */
	getLayoutState(): EdgeZoneLayoutState;
	/** Clean up and release resources */
	destroy(): void;
}

/**
 * Padding detection result from layout observer.
 */
export type PaddingDetectionResult = {
	padding: { left: number; right: number };
	leafRect: DOMRect | null;
	contentRect: DOMRect | null;
};

/**
 * Options for creating edge zones.
 */
export type CreateEdgeZonesOptions = {
	/** Container element to attach zones to */
	container: HTMLElement;
};
