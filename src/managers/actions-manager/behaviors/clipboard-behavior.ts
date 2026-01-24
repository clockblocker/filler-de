import { handleClipboardCopy } from "../../../commanders/librarian/user-event-router/handlers/clipboard-handler";
import type {
	ClipboardPayload,
	EventHandler,
} from "../../obsidian/user-event-interceptor";
import { HandlerOutcome } from "../../obsidian/user-event-interceptor/user-event-interceptor";

/**
 * Create a handler that strips metadata from clipboard copy.
 * Removes go-back links and metadata sections from copied text.
 */
export function createClipboardHandler(): EventHandler<ClipboardPayload> {
	return {
		doesApply: () => true, // Always try to handle clipboard events
		handle: (payload) => {
			const result = handleClipboardCopy(payload);
			if (result === null) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return { data: result, outcome: HandlerOutcome.Modified };
		},
	};
}
