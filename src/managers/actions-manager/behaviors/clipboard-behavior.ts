import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
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
			const original = payload.originalText;
			let strippedText = goBackLinkHelper.strip(original);
			// getBody() returns sync transform despite Transform type allowing Promise
			strippedText = noteMetadataHelper.getBody()(strippedText) as string;

			// Only return modified if we actually stripped something
			if (strippedText === original.trim()) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return {
				data: { ...payload, modifiedText: strippedText },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
