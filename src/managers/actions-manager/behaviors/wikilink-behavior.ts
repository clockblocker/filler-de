import type { Codecs } from "../../../commanders/librarian/codecs";
import { CODEX_CORE_NAME } from "../../../commanders/librarian/types/consts/literals";
import { resolveAliasFromSuffix } from "../../../stateless-services/wikilink-alias-service";
import {
	type EventHandler,
	HandlerOutcome,
	type WikilinkPayload,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler for wikilink completion.
 * Adds aliases for library files (files with suffix parts).
 *
 * @param codecs - Codec instances for parsing
 */
export function createWikilinkHandler(
	codecs: Codecs,
): EventHandler<WikilinkPayload> {
	return {
		doesApply: () => true, // Let the handler decide based on link content
		handle: (payload) => {
			// Use the stateless service with codecs as suffix parser
			const result = resolveAliasFromSuffix(
				payload.linkContent,
				codecs.suffix,
				(name) => name.startsWith(CODEX_CORE_NAME),
			);
			if (result === null) {
				return { outcome: HandlerOutcome.Passthrough };
			}
			return {
				data: { ...payload, aliasToInsert: result.alias },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
