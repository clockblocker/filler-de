/**
 * Lifecycle event types for LeafLifecycleManager.
 *
 * These events abstract away Obsidian's quirky event ordering
 * and provide clean lifecycle hooks for subscribers.
 */

/**
 * Navigation origin - where did the navigation start from?
 */
export type NavigationOrigin = "plugin" | "external";

/**
 * Emitted when a markdown view's DOM is ready for UI attachment.
 * Subscribers can safely query/attach to the view's DOM.
 */
export type ViewReadyEvent = {
	kind: "view-ready";
	/** File path of the opened file */
	filePath: string;
	/** Whether this was a plugin-initiated navigation (cd) vs user navigation */
	origin: NavigationOrigin;
};

/**
 * Emitted before the view is about to change (navigation away).
 * Subscribers should detach any UI from the current view.
 */
export type ViewDetachingEvent = {
	kind: "view-detaching";
	/** File path of the file being navigated away from (if any) */
	previousFilePath: string | null;
};

/**
 * Emitted on leaf changes that don't involve navigation to a new file.
 * E.g., layout changes, pane splits, focus changes.
 */
export type LayoutChangedEvent = {
	kind: "layout-changed";
	/** Current file path (if any) */
	currentFilePath: string | null;
};

/**
 * Union type for all lifecycle events.
 */
export type LeafLifecycleEvent =
	| ViewReadyEvent
	| ViewDetachingEvent
	| LayoutChangedEvent;

/**
 * Handler for lifecycle events.
 */
export type LeafLifecycleHandler = (event: LeafLifecycleEvent) => void;

/**
 * Teardown function to unsubscribe.
 */
export type LifecycleTeardown = () => void;
