import type {
	Teardown as HandlerTeardown,
	UserEventHandler as EventHandler,
	UserEventKind,
	UserEventResult as HandleResult,
} from "../contracts";

export type { EventHandler, HandleResult, HandlerTeardown };

export const HandlerOutcome = {
	Effect: "effect",
	Handled: "handled",
	Passthrough: "passthrough",
} as const;

export type HandlerOutcome =
	(typeof HandlerOutcome)[keyof typeof HandlerOutcome];

export type EventKind = UserEventKind;
