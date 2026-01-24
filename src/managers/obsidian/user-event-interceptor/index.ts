/**
 * UserEventInterceptor module - unified user event handling with behavior chains.
 *
 * Architecture:
 * - Detectors capture raw DOM events
 * - Codecs encode events into structural payloads
 * - Behavior chain transforms payloads
 * - Default actions apply final transformations
 *
 * Usage:
 * 1. Get the behavior registry from UserEventInterceptor
 * 2. Register behaviors for specific payload kinds
 * 3. Behaviors transform payloads in priority order
 */

// Main interceptor
export { UserEventInterceptor } from "./user-event-interceptor";

// Behavior chain
export {
	anyApplicable,
	BehaviorRegistry,
	executeChain,
	getBehaviorRegistry,
	resetBehaviorRegistry,
} from "./behavior-chain";

// Types
export type { BehaviorContext, BehaviorRegistration } from "./types/behavior";
export { defineBehavior } from "./types/behavior";
export type { AnyPayload, PayloadKind, PayloadWithPath } from "./types/payload-base";
export { PayloadKind as PayloadKindEnum } from "./types/payload-base";
export type { ChainResult, TransformKind, TransformResult } from "./types/transform-kind";
export { TransformKind as TransformKindEnum } from "./types/transform-kind";

// Payload types
export type { CheckboxPayload } from "./events/click/checkbox/payload";
export type { CheckboxFrontmatterPayload } from "./events/click/checkbox-frontmatter/payload";
export type { ActionElementPayload } from "./events/click/action-element/payload";
export type { ClipboardPayload } from "./events/clipboard/payload";
export type { SelectAllPayload } from "./events/select-all/payload";
export type { SelectionChangedPayload } from "./events/selection-changed/payload";
export type { WikilinkPayload } from "./events/wikilink/payload";

// Legacy bridge
export { createLegacyBridge, LegacyBridge } from "./legacy-bridge";

// Legacy exports for backward compatibility (deprecated)
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
export { InterceptableUserEventKind } from "./types/user-event";
