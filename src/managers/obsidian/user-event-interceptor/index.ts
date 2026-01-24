/**
 * UserEventInterceptor module - unified user event handling with handler pattern.
 *
 * Architecture:
 * - Detectors capture raw DOM events
 * - Codecs encode events into structural payloads
 * - Single handler per event type transforms/handles payload
 * - Default actions apply final transformations
 *
 * Usage:
 * 1. Get UserEventInterceptor instance
 * 2. Register handlers for specific payload kinds with setHandler()
 * 3. Handlers receive payloads and return HandleResult
 */

export type { ActionElementPayload } from "./events/click/action-element/payload";

// Event payloads
export type { CheckboxPayload } from "./events/click/checkbox/payload";
export type { CheckboxFrontmatterPayload } from "./events/click/checkbox-frontmatter/payload";
export type { ClipboardPayload } from "./events/clipboard/payload";
export type { SelectAllPayload } from "./events/select-all/payload";
export type { SelectionChangedPayload } from "./events/selection-changed/payload";
export type { WikilinkPayload } from "./events/wikilink/payload";

// Handler types
export type {
	EventHandler,
	HandleResult,
	HandlerContext,
	HandlerTeardown,
} from "./types/handler";

export { HandlerOutcome } from "./types/handler";

// Payload types
export {
	type AnyPayload,
	PayloadKind,
	type PayloadWithPath,
} from "./types/payload-base";

// Main interceptor
export {
	type HandlerInvoker,
	UserEventInterceptor,
} from "./user-event-interceptor";
