/**
 * Thin handler for frontmatter property checkbox clicks.
 * Delegates to Librarian for all logic.
 */

import type { Librarian } from "../../../commanders/librarian/librarian";
import {
	type CheckboxFrontmatterPayload,
	type EventHandler,
	HandlerOutcome,
} from "../user-event-interceptor";

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
			const maybeWithHandler = librarian as unknown as {
				handlePropertyCheckboxClick?: (
					payload: CheckboxFrontmatterPayload,
				) => void;
			};
			maybeWithHandler.handlePropertyCheckboxClick?.(payload);
			return { outcome: HandlerOutcome.Handled };
		},
	};
}
