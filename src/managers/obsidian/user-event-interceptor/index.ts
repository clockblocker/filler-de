/**
 * UserEventInterceptor module - unified user event handling.
 */

export type {
	CheckboxClickedEvent,
	ClipboardCopyEvent,
	PropertyCheckboxClickedEvent,
	SelectAllEvent,
	Teardown,
	UserEvent,
	UserEventHandler,
	WikilinkCompletedEvent,
} from "./types/user-event";
export { UserEventInterceptor } from "./user-event-interceptor";
