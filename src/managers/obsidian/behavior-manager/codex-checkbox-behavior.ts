/**
 * Thin handler for task checkbox clicks inside codex files.
 * Delegates to Librarian for all logic.
 */

import type { Librarian } from "../../../commanders/librarian/librarian";
import {
	type CheckboxPayload,
	type EventHandler,
	HandlerOutcome,
} from "../user-event-interceptor";

/**
 * Create a handler for task checkbox clicks in codex files.
 * Thin routing layer - delegates to librarian methods.
 */
export function createCodexCheckboxHandler(
	librarian: Librarian,
): EventHandler<CheckboxPayload> {
	return {
		doesApply: (payload) =>
			librarian.isCodexInsideLibrary(payload.splitPath),
		handle: async (payload) => {
			await librarian.handleCodexCheckboxClick(payload);
			return { outcome: HandlerOutcome.Handled };
		},
	};
}
