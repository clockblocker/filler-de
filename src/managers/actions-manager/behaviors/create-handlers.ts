/**
 * Handler factory for user event registration.
 * Creates handlers array that main.ts registers with UserEventInterceptor.
 *
 * Architecture:
 * - Stateless handlers (clipboard, select-all, wikilink) call services directly
 * - Librarian handlers call librarian methods for tree operations
 */

import type { CodecRules, Codecs } from "../../../commanders/librarian/codecs";
import { isCodexSplitPath } from "../../../commanders/librarian/healer/library-tree/codex/helpers";
import { tryParseAsInsideLibrarySplitPath } from "../../../commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library";
import type { Librarian } from "../../../commanders/librarian/librarian";
import {
	type AnyPayload,
	type CheckboxFrontmatterPayload,
	type CheckboxPayload,
	type EventHandler,
	HandlerOutcome,
	PayloadKind,
} from "../../obsidian/user-event-interceptor";
import { createClipboardHandler } from "./clipboard-behavior";
import { createSelectAllHandler } from "./select-all-behavior";
import { createWikilinkHandler } from "./wikilink-behavior";

/**
 * Handler definition with kind and handler.
 */
export type HandlerDef = {
	kind: PayloadKind;
	handler: EventHandler<AnyPayload>;
};

/**
 * Create all handlers for user event registration.
 *
 * @param librarian - Librarian instance for tree operations
 * @param codecs - Codec instances for parsing
 * @param rules - Codec rules for path parsing
 */
export function createHandlers(
	librarian: Librarian,
	codecs: Codecs,
	rules: CodecRules,
): HandlerDef[] {
	return [
		// Stateless handlers (call services directly)
		{
			kind: PayloadKind.ClipboardCopy,
			handler: createClipboardHandler() as EventHandler<AnyPayload>,
		},
		{
			kind: PayloadKind.SelectAll,
			handler: createSelectAllHandler() as EventHandler<AnyPayload>,
		},
		{
			kind: PayloadKind.WikilinkCompleted,
			handler: createWikilinkHandler(codecs) as EventHandler<AnyPayload>,
		},

		// Librarian handlers (call librarian methods)
		{
			kind: PayloadKind.CheckboxInFrontmatterClicked,
			handler: {
				doesApply: () => true, // Let librarian method decide based on property name
				handle: (payload) => {
					librarian.handlePropertyCheckboxClick(
						payload as CheckboxFrontmatterPayload,
					);
					return { outcome: HandlerOutcome.Handled };
				},
			} as EventHandler<AnyPayload>,
		},
		{
			kind: PayloadKind.CheckboxClicked,
			handler: {
				doesApply: (payload) => {
					const p = payload as CheckboxPayload;
					// Only handle codex files inside library
					if (!isCodexSplitPath(p.splitPath)) return false;
					const libraryScopedResult = tryParseAsInsideLibrarySplitPath(
						p.splitPath,
						rules,
					);
					return libraryScopedResult.isOk();
				},
				handle: (payload) => {
					librarian.handleCodexCheckboxClick(payload as CheckboxPayload);
					return { outcome: HandlerOutcome.Handled };
				},
			} as EventHandler<AnyPayload>,
		},
	];
}
