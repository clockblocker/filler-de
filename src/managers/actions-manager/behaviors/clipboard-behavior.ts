import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { logger } from "../../../utils/logger";
import {
	type ClipboardPayload,
	type EventHandler,
	HandlerOutcome,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler that strips metadata from clipboard copy.
 * Removes go-back links and metadata sections from copied text.
 */
export function createClipboardHandler(): EventHandler<ClipboardPayload> {
	return {
		doesApply: () => true, // Always try to handle clipboard events
		handle: (payload) => {
			const original = payload.originalText;
			logger.info("[clipboard] === START ===");
			logger.info("[clipboard] original.length:", original.length);
			logger.info(
				"[clipboard] original first 300 chars:",
				JSON.stringify(original.slice(0, 300)),
			);

			let strippedText = goBackLinkHelper.strip(original);
			logger.info(
				"[clipboard] after goBackLink strip, length:",
				strippedText.length,
			);
			logger.info(
				"[clipboard] after goBackLink strip, first 300 chars:",
				JSON.stringify(strippedText.slice(0, 300)),
			);

			strippedText = noteMetadataHelper.strip(strippedText);
			logger.info(
				"[clipboard] after metadata strip, length:",
				strippedText.length,
			);
			logger.info(
				"[clipboard] after metadata strip, first 300 chars:",
				JSON.stringify(strippedText.slice(0, 300)),
			);

			// Only return modified if we actually stripped something
			if (strippedText === original.trim()) {
				logger.info("[clipboard] No change, passthrough");
				return { outcome: HandlerOutcome.Passthrough };
			}
			logger.info("[clipboard] Modified, returning stripped text");
			return {
				data: { ...payload, modifiedText: strippedText },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
