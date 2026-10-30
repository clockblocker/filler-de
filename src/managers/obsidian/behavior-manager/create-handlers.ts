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
	type PayloadFor,
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

/** A clicked link, as the plugin is told it. */
export type LinkClick = {
	/** The link's target, as written. */
	readonly target: string;
	/** The note it was clicked in. */
	readonly sourcePath: string;
	/** Where it stands in that note's text, inside its `[[…]]`, when the layer could tell. */
	readonly offset?: number;
};

const linkClickOf = (
	payload: PayloadFor<"WikilinkClicked"> | PayloadFor<"WikilinkObserved">,
): LinkClick => ({
	...(payload.offset === undefined ? {} : { offset: payload.offset }),
	sourcePath: payload.sourcePath,
	target: payload.target.basename,
});

/**
 * Create all handlers for user event registration.
 * All librarian-dependent handlers delegate to librarian methods.
 *
 * @param librarian - Librarian instance for tree operations
 * @param onWikilinkClicked - Run with every clicked link, once Obsidian
 *   was told to open it, in the click's fiber: Classify attests its
 *   occurrence in the background (#281), then waits there for a Reading's
 *   Knowledge to open its note again
 * @param onWikilinkObserved - Run with every Cmd/Ctrl-clicked or
 *   middle-clicked link, which Obsidian opens on its own
 */
export function createHandlers(
	librarian: Librarian,
	onWikilinkClicked?: (
		click: LinkClick,
	) => Effect.Effect<void, UserEventFailure>,
	onWikilinkObserved?: (
		click: LinkClick,
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
					onWikilinkClicked(linkClickOf(payload)),
				doesApply: () => true,
				// Obsidian opens the link, as it would have.
				handle: () =>
					Effect.succeed({ outcome: "passthrough" } as const),
			},
			kind: UserEventKinds.WikilinkClicked,
		});
	}

	// A Cmd/Ctrl-click or middle click, which Obsidian opens on its own.
	if (onWikilinkObserved) {
		handlers.push({
			handler: {
				afterwards: (payload) =>
					onWikilinkObserved(linkClickOf(payload)),
				doesApply: () => true,
				// The layer applies nothing to an observed click.
				handle: () =>
					Effect.succeed({ outcome: "passthrough" } as const),
			},
			kind: UserEventKinds.WikilinkObserved,
		});
	}

	return handlers;
}
