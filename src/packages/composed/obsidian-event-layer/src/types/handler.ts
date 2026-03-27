import type {
	UserEventHandler as EventHandler,
	UserEventResult as HandleResult,
	Teardown as HandlerTeardown,
	UserEventKind,
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
