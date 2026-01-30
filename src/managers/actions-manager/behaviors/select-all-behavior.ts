import { calculateSmartRange } from "../../../stateless-helpers/content-range-service";
import {
	type EventHandler,
	HandlerOutcome,
	type SelectAllPayload,
} from "../../obsidian/user-event-interceptor";

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
				data: { ...payload, customSelection: { from, to } },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
