/**
 * DOM Selector Registry - single source of truth for all DOM selectors.
 *
 * Centralizes DOM selectors to:
 * - Prevent typos and inconsistencies
 * - Make selector changes easy
 * - Improve discoverability
 *
 * Usage:
 *   import { DomSelectors } from './dom-selectors';
 *   element.querySelector(DomSelectors.CM_CONTENT_CONTAINER);
 */

export const DomSelectors = {
	/** Bottom toolbar button class */
	BOTTOM_OVERLAY_BTN_CLASS: "my-bottom-overlay-btn",

	// ─── Bottom Toolbar ───
	/** Bottom toolbar overlay container class */
	BOTTOM_OVERLAY_CLASS: "my-bottom-overlay",
	/** Bottom overlay host class (applied to view.contentEl) */
	BOTTOM_OVERLAY_HOST_CLASS: "bottom-overlay-host",
	/** CodeMirror block ID reference */
	CM_BLOCK_ID: ".cm-blockid",
	/** CodeMirror content parent */
	CM_CONTENT: ".cm-content",
	// ─── CodeMirror (Editor) ───
	/** CodeMirror 6 content container - used for view readiness detection */
	CM_CONTENT_CONTAINER: ".cm-contentContainer",
	/** CodeMirror internal link (edit mode) */
	CM_INTERNAL_LINK: ".cm-hmd-internal-link",
	/** CodeMirror editor line */
	CM_LINE: ".cm-line",

	// ─── Action Buttons ───
	/** Data attribute for action buttons */
	DATA_ACTION: "[data-action]",
	/** Data attribute name (without brackets) for dataset access */
	DATA_ACTION_ATTR: "action",
	/** Data attribute for link target (href) */
	DATA_HREF: "data-href",
	/** Disabled button class */
	DISABLED_CLASS: "is-disabled",

	// ─── Edge Zones ───
	/** Edge navigation zone class */
	EDGE_ZONE_CLASS: "edge-nav-zone",
	/** Hide status bar class (applied to body) */
	HIDE_STATUS_BAR_CLASS: "hide-status-bar",
	/** File name edit field */
	INLINE_TITLE: ".inline-title",
	/** Inline title class (for classList.contains check) */
	INLINE_TITLE_CLASS: "inline-title",

	// ─── Internal Links ───
	/** Internal link in reading mode */
	INTERNAL_LINK: "a.internal-link",
	/** Internal link class (for classList.contains check) */
	INTERNAL_LINK_CLASS: "internal-link",

	// ─── Metadata (Frontmatter) ───
	/** Frontmatter section container */
	METADATA_CONTAINER: ".metadata-container",
	/** Individual property row in frontmatter */
	METADATA_PROPERTY: ".metadata-property",
	/** Property name element in frontmatter */
	METADATA_PROPERTY_KEY: ".metadata-property-key",
	/** Overflow menu button class */
	OVERFLOW_BTN_CLASS: "overflow-btn",
	/** Overflow menu item class */
	OVERFLOW_ITEM_CLASS: "bottom-overflow-item",
	/** Overflow menu container class */
	OVERFLOW_MENU_CLASS: "bottom-overflow-menu",

	// ─── Selection Toolbar ───
	/** Selection toolbar container class */
	SELECTION_TOOLBAR_CLASS: "selection-toolbar",

	// ─── Task Checkboxes ───
	/** Task checkbox class (for classList.contains check) */
	TASK_CHECKBOX_CLASS: "task-list-item-checkbox",
	/** Toolbar separator class */
	TOOLBAR_SEPARATOR_CLASS: "bottom-toolbar-separator",

	// ─── Workspace ───
	/** Obsidian workspace leaf container */
	WORKSPACE_LEAF: ".workspace-leaf",
} as const;

/**
 * Type for DOM selector keys.
 */
export type DomSelectorKey = keyof typeof DomSelectors;
