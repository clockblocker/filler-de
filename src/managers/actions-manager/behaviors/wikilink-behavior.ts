import type { Codecs } from "../../../commanders/librarian/codecs";
import { handleWikilinkCompleted } from "../../../commanders/librarian/user-event-router/handlers/wikilink-handler";
import {
	type EventHandler,
	HandlerOutcome,
	type WikilinkPayload,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler for wikilink completion.
 * Adds aliases for library files (files with suffix parts).
 *
 * @param codecs - Codec instances for parsing
 */
export function createWikilinkHandler(
	codecs: Codecs,
): EventHandler<WikilinkPayload> {
	return {
		doesApply: () => true, // Let the handler decide based on link content
		handle: (payload) => {
			const result = handleWikilinkCompleted(payload, codecs);
			if (result === null) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return { data: result, outcome: HandlerOutcome.Modified };
		},
	};
}
