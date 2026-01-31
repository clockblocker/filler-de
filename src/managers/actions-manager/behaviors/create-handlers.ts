/**
 * Handler factory for user event registration.
 * Creates handlers array that main.ts registers with UserEventInterceptor.
 *
 * Architecture:
 * - Stateless handlers (clipboard, select-all) call services directly
 * - All other handlers delegate to Librarian or Textfresser methods
 */

import type { Librarian } from "../../../commanders/librarian/librarian";
import type { Textfresser } from "../../../commanders/textfresser/textfresser";
import {
	type AnyPayload,
	type EventHandler,
	PayloadKind,
} from "../../obsidian/user-event-interceptor";
import { createCheckboxFrontmatterHandler } from "./checkbox-behavior";
import { createClipboardHandler } from "./clipboard-behavior";
import { createCodexCheckboxHandler } from "./codex-checkbox-behavior";
import { createSelectAllHandler } from "./select-all-behavior";
import { createWikilinkCompletionHandler } from "./wikilink-complition-behavior";

/**
 * Handler definition with kind and handler.
 */
export type HandlerDef = {
	kind: PayloadKind;
	handler: EventHandler<AnyPayload>;
};

/**
 * Create all handlers for user event registration.
 * All librarian-dependent handlers delegate to librarian methods.
 *
 * @param librarian - Librarian instance for tree operations
 * @param textfresser - Textfresser instance for wikilink click tracking
 */
export function createHandlers(
	librarian: Librarian,
	textfresser?: Textfresser,
): HandlerDef[] {
	const handlers: HandlerDef[] = [
		// Stateless handlers (call services directly)
		{
			handler: createClipboardHandler() as EventHandler<AnyPayload>,
			kind: PayloadKind.ClipboardCopy,
		},
		{
			handler: createSelectAllHandler() as EventHandler<AnyPayload>,
			kind: PayloadKind.SelectAll,
		},

		// Librarian handlers (thin routing to librarian methods)
		{
			handler: createWikilinkCompletionHandler(
				librarian,
			) as EventHandler<AnyPayload>,
			kind: PayloadKind.WikilinkCompleted,
		},
		{
			handler: createCheckboxFrontmatterHandler(
				librarian,
			) as EventHandler<AnyPayload>,
			kind: PayloadKind.CheckboxInFrontmatterClicked,
		},
		{
			handler: createCodexCheckboxHandler(
				librarian,
			) as EventHandler<AnyPayload>,
			kind: PayloadKind.CheckboxClicked,
		},
	];

	// Textfresser handler (wikilink click tracking)
	if (textfresser) {
		handlers.push({
			handler: textfresser.createHandler() as EventHandler<AnyPayload>,
			kind: PayloadKind.WikilinkClicked,
		});
	}

	return handlers;
}
