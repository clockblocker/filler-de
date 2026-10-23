/**
 * The Librarian's and the plugin's handlers of user events, which
 * `main.ts` sets on the event layer once a Librarian runs. Each handler's
 * program runs at its event's edge, `user-event.<kind>`.
 *
 * - Stateless handlers (clipboard, select-all) call helpers directly.
 * - The others delegate to the Librarian.
 * - A property checkbox has no handler: Obsidian toggles the property,
 *   and the click does nothing more, as before (the Librarian has no
 *   handler for it).
 */

import {
	type UserEventFailure,
	type UserEventHandler,
	type UserEventKind,
	UserEventKind as UserEventKinds,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import type { Librarian } from "../../../commanders/librarian/librarian";
import { createClipboardHandler } from "./clipboard-behavior";
import { createCodexCheckboxHandler } from "./codex-checkbox-behavior";
import { createSelectAllHandler } from "./select-all-behavior";
import { createWikilinkCompletionHandler } from "./wikilink-complition-behavior";

/**
 * Handler definition with kind and handler.
 */
type HandlerDef = {
	[K in UserEventKind]: {
		handler: UserEventHandler<K>;
		kind: K;
	};
}[UserEventKind];

/**
 * Create all handlers for user event registration.
 * All librarian-dependent handlers delegate to librarian methods.
 *
 * @param librarian - Librarian instance for tree operations
 * @param onWikilinkClicked - Run with every clicked link's target, once
 *   Obsidian was told to open it, in the click's fiber: Classify waits
 *   there for a Reading's Knowledge to open its note again
 */
export function createHandlers(
	librarian: Librarian,
	onWikilinkClicked?: (
		target: string,
	) => Effect.Effect<void, UserEventFailure>,
): HandlerDef[] {
	const handlers: HandlerDef[] = [
		// Stateless handlers (call services directly)
		{
			handler: createClipboardHandler(),
			kind: UserEventKinds.ClipboardCopy,
		},
		{
			handler: createSelectAllHandler(),
			kind: UserEventKinds.SelectAll,
		},

		// Librarian handlers (thin routing to librarian methods)
		{
			handler: createWikilinkCompletionHandler(librarian),
			kind: UserEventKinds.WikilinkCompleted,
		},
		{
			handler: createCodexCheckboxHandler(librarian),
			kind: UserEventKinds.CheckboxClicked,
		},
	];

	// Classify reopens a Reading note once its Knowledge lands
	if (onWikilinkClicked) {
		handlers.push({
			handler: {
				afterwards: (payload) =>
					onWikilinkClicked(payload.target.basename),
				doesApply: () => true,
				// Obsidian opens the link, as it would have.
				handle: () =>
					Effect.succeed({ outcome: "passthrough" } as const),
			},
			kind: UserEventKinds.WikilinkClicked,
		});
	}

	return handlers;
}
