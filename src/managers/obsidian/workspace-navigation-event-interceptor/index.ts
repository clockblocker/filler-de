/**
 * WorkspaceEventInterceptor module - unified workspace event handling.
 */

export type {
	Teardown,
	WorkspaceEvent,
} from "./types/workspace-event";

export { WorkspaceEventKind } from "./types/workspace-event";
export { WorkspaceEventInterceptor } from "./workspace-event-interceptor";
