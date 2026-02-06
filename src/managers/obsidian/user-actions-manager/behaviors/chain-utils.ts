import {
	type AnyPayload,
	type EventHandler,
	type HandleResult,
	type HandlerContext,
	HandlerOutcome,
} from "../../user-event-interceptor";

/**
 * Chain multiple handlers for the same event type.
 * Handlers are tried in order; first to apply wins.
 *
 * @param handlers - Handlers to chain (first match wins)
 * @returns Combined handler
 */
export function chainHandlers<P extends AnyPayload>(
	...handlers: EventHandler<P>[]
): EventHandler<P> {
	return {
		doesApply: (payload: P): boolean => {
			return handlers.some((h) => h.doesApply(payload));
		},
		handle: async (
			payload: P,
			ctx: HandlerContext,
		): Promise<HandleResult<P>> => {
			for (const handler of handlers) {
				if (handler.doesApply(payload)) {
					return handler.handle(payload, ctx);
				}
			}
			// No handler applied - passthrough
			return { outcome: HandlerOutcome.Passthrough };
		},
	};
}
