import { goBackLinkHelper } from "@textfresser/note-addressing";
import type {
	UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";

/**
 * Create a handler that strips metadata from clipboard copy.
 * Removes go-back links and metadata sections from copied text.
 */
export function createClipboardHandler(): UserEventHandler<
	typeof UserEventKind.ClipboardCopy
> {
	return {
		doesApply: () => true, // Always try to handle clipboard events
		// Synchronous: the clipboard is writable only while the copy is
		// dispatched.
		handle: (payload) =>
			Effect.sync(() => {
				const original = payload.originalText;
				const strippedText = noteMetadataHelper.strip(
					goBackLinkHelper.strip(original),
				);

				// Only return modified if we actually stripped something
				if (strippedText === original.trim()) {
					return { outcome: "passthrough" } as const;
				}
				return {
					effect: { modifiedText: strippedText },
					outcome: "effect",
				} as const;
			}),
	};
}
