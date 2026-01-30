import { contentRangeHelper } from "../../../stateless-helpers/content-range";
import {
	type ClipboardPayload,
	type EventHandler,
	HandlerOutcome,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler that strips metadata from clipboard copy.
 * Removes go-back links and metadata sections from copied text.
 */
export function createClipboardHandler(): EventHandler<ClipboardPayload> {
	return {
		doesApply: () => true, // Always try to handle clipboard events
		handle: (payload) => {
			const strippedText = contentRangeHelper.stripForClipboard(payload.originalText);
			if (strippedText === null) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return {
				data: { ...payload, modifiedText: strippedText },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
