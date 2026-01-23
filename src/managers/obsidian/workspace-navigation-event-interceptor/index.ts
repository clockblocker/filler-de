/**
 * WorkspaceEventInterceptor module - unified workspace event handling.
 */

export type {
	FileOpenEvent,
	LayoutChangeEvent,
	LayoutReadyEvent,
	ResizeEvent,
	Teardown,
	WorkspaceEvent,
	WorkspaceEventHandler,
} from "./types/workspace-event";

export { WorkspaceEventKind } from "./types/workspace-event";
export { WorkspaceEventInterceptor } from "./workspace-event-interceptor";
