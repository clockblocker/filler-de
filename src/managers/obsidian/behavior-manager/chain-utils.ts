import {
	type UserEventHandler,
	type UserEventKind,
	type UserEventPayloadMap,
} from "../user-event-interceptor";

/**
 * Chain multiple handlers for the same event type.
 * Handlers are tried in order; first to apply wins.
 *
 * @param handlers - Handlers to chain (first match wins)
 * @returns Combined handler
 */
export function chainHandlers<K extends UserEventKind>(
	...handlers: UserEventHandler<K>[]
): UserEventHandler<K> {
	return {
		doesApply: (payload: UserEventPayloadMap[K]): boolean => {
			return handlers.some((h) => h.doesApply(payload));
		},
		handle: async (payload: UserEventPayloadMap[K]) => {
			for (const handler of handlers) {
				if (handler.doesApply(payload)) {
					return handler.handle(payload);
				}
			}
			// No handler applied - passthrough
			return { outcome: "passthrough" } as const;
		},
	};
}
