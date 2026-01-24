import {
	type EventHandler,
	HandlerOutcome,
	type SelectAllPayload,
} from "../../obsidian/user-event-interceptor";
import { calculateSmartRange } from "../../../commanders/librarian/user-event-router/handlers/select-all-handler";

/**
 * Create a handler for smart select-all.
 * Excludes frontmatter, go-back links, and metadata sections.
 */
export function createSelectAllHandler(): EventHandler<SelectAllPayload> {
	return {
		doesApply: () => true, // Always try to handle select-all events
		handle: (payload) => {
			const { from, to } = calculateSmartRange(payload.content);

			// If the range covers everything or nothing, passthrough
			if ((from === 0 && to === payload.content.length) || from >= to) {
				return { outcome: HandlerOutcome.Passthrough };
			}

			// Return modified payload with custom selection
			return {
				outcome: HandlerOutcome.Modified,
				data: { ...payload, customSelection: { from, to } },
			};
		},
	};
}
