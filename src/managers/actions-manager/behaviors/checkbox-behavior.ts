/**
 * Thin handler for frontmatter property checkbox clicks.
 * Delegates to Librarian for all logic.
 */

import type { Librarian } from "../../../commanders/librarian/librarian";
import {
	type CheckboxFrontmatterPayload,
	type EventHandler,
	HandlerOutcome,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler for frontmatter property checkbox clicks.
 * Thin routing layer - delegates to librarian methods.
 */
export function createCheckboxFrontmatterHandler(
	librarian: Librarian,
): EventHandler<CheckboxFrontmatterPayload> {
	return {
		doesApply: () => true,
		handle: (payload) => {
			librarian.handlePropertyCheckboxClick(payload);
			return { outcome: HandlerOutcome.Handled };
		},
	};
}
