/**
 * Workspace event types - discriminated union for Obsidian workspace events.
 *
 * Unlike UserEvents, workspace events are notifications (no action callbacks).
 */

import { z } from "zod";

const WorkspaceEventKindSchema = z.enum([
	"LayoutReady",
	"LayoutChange",
	"FileOpen",
	"Resize",
	"Scroll",
]);
export type WorkspaceEventKind = z.infer<typeof WorkspaceEventKindSchema>;
export const WorkspaceEventKind = WorkspaceEventKindSchema.enum;

// ─── Event Types ───

/**
 * Emitted once when Obsidian layout is fully ready. Normally, it's fired only on plugin init.
 */
type LayoutReadyEvent = {
	kind: typeof WorkspaceEventKind.LayoutReady;
};

/**
 * Emitted when workspace layout changes (panes opened/closed/moved).
 */
type LayoutChangeEvent = {
	kind: typeof WorkspaceEventKind.LayoutChange;
};

/**
 * Emitted when a file is opened (user opens/switches to a file).
 */
type FileOpenEvent = {
	kind: typeof WorkspaceEventKind.FileOpen;
	/** The opened system path, or null if no file (e.g., empty pane). */
	file: string | null;
};

/**
 * Emitted when workspace is resized.
 */
type ResizeEvent = {
	kind: typeof WorkspaceEventKind.Resize;
};

/**
 * Emitted when user scrolls within any pane.
 */
type ScrollEvent = {
	kind: typeof WorkspaceEventKind.Scroll;
};

// ─── Union Type ───

export type WorkspaceEvent =
	| LayoutReadyEvent
	| LayoutChangeEvent
	| FileOpenEvent
	| ResizeEvent
	| ScrollEvent;

// ─── Handler ───

export type WorkspaceEventHandler = (event: WorkspaceEvent) => void;

export type Teardown = () => void;
