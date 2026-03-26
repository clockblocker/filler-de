import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import {
	type ClipboardPayload,
	type UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";

/**
 * Create a handler that strips metadata from clipboard copy.
 * Removes go-back links and metadata sections from copied text.
 */
export function createClipboardHandler(): UserEventHandler<
	typeof UserEventKind.ClipboardCopy
> {
	return {
		doesApply: () => true, // Always try to handle clipboard events
		handle: (payload) => {
			const original = payload.originalText;
			let strippedText = goBackLinkHelper.strip(original);
			strippedText = noteMetadataHelper.strip(strippedText);

			// Only return modified if we actually stripped something
			if (strippedText === original.trim()) {
				return { outcome: "passthrough" } as const;
			}
			return {
				effect: { modifiedText: strippedText },
				outcome: "effect",
			};
		},
	};
}
