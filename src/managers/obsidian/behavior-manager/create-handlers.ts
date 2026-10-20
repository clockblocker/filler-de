/**
 * Handler factory for user event registration.
 * Creates handlers array that main.ts registers with UserEventInterceptor.
 *
 * Architecture:
 * - Stateless handlers (clipboard, select-all) call services directly
 * - All other handlers delegate to Librarian or Textfresser methods
 */

import {
	type UserEventHandler,
	type UserEventKind,
	UserEventKind as UserEventKinds,
} from "@textfresser/obsidian-event-layer";
import type { Librarian } from "../../../commanders/librarian/librarian";
import type { Textfresser } from "../../../commanders/textfresser/textfresser";
import { createCheckboxFrontmatterHandler } from "./checkbox-behavior";
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
 * @param textfresser - Textfresser instance for wikilink click tracking
 * @param onWikilinkClicked - Told every clicked link's target, such as
 *   Classify waiting for a Reading's Knowledge to scroll to it
 */
export function createHandlers(
	librarian: Librarian,
	textfresser?: Textfresser,
	onWikilinkClicked?: (target: string) => void,
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
			handler: createCheckboxFrontmatterHandler(librarian),
			kind: UserEventKinds.CheckboxFrontmatterClicked,
		},
		{
			handler: createCodexCheckboxHandler(librarian),
			kind: UserEventKinds.CheckboxClicked,
		},
	];

	// Textfresser handler (wikilink click tracking), and Classify's scroll to entry
	const tracking = textfresser?.createHandler();
	if (tracking || onWikilinkClicked) {
		handlers.push({
			handler: {
				doesApply: (payload) => tracking?.doesApply(payload) ?? true,
				handle: (payload) => {
					onWikilinkClicked?.(payload.target.basename);
					return tracking
						? tracking.handle(payload)
						: ({ outcome: "passthrough" } as const);
				},
			},
			kind: UserEventKinds.WikilinkClicked,
		});
	}

	return handlers;
}
