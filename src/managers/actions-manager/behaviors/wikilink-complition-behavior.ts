/**
 * Thin handler for wikilink completion.
 * Delegates to Librarian for alias resolution.
 */

import type { Librarian } from "../../../commanders/librarian/librarian";
import {
	type EventHandler,
	HandlerOutcome,
	type WikilinkPayload,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler for wikilink completion.
 * Thin routing layer - delegates to librarian methods.
 */
export function createWikilinkCompletionHandler(
	librarian: Librarian,
): EventHandler<WikilinkPayload> {
	return {
		doesApply: () => true,
		handle: (payload) => {
			const alias = librarian.resolveWikilinkAlias(payload.linkContent);
			if (alias === null) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return {
				data: { ...payload, aliasToInsert: alias },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
