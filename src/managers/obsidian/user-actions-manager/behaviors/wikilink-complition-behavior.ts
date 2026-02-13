/**
 * Thin handler for wikilink completion.
 * Delegates to Librarian for alias resolution and corename auto-resolution.
 *
 * Resolution order:
 * 1. Suffix-based alias (existing files with suffix → show alias)
 * 2. Obsidian can resolve the link → passthrough
 * 3. Corename lookup in tree → replace target with suffixed basename + alias
 */

import type { Librarian } from "../../../../commanders/librarian/librarian";
import {
	type EventHandler,
	type HandlerContext,
	HandlerOutcome,
	type WikilinkPayload,
} from "../../user-event-interceptor";
import { pickClosestLeaf } from "./pick-closest-leaf";

/**
 * Create a handler for wikilink completion.
 * Thin routing layer - delegates to librarian methods.
 */
export function createWikilinkCompletionHandler(
	librarian: Librarian,
): EventHandler<WikilinkPayload> {
	return {
		doesApply: () => true,
		handle: (payload, ctx: HandlerContext) => {
			// 1. Try suffix-based alias resolution (existing behavior)
			const alias = librarian.resolveWikilinkAlias(payload.linkContent);
			if (alias !== null) {
				return {
					data: { ...payload, aliasToInsert: alias },
					outcome: HandlerOutcome.Modified,
				};
			}

			// 2. Check if Obsidian can already resolve this link
			const activeFile = ctx.app.workspace.getActiveFile();
			if (!activeFile) {
				return { outcome: HandlerOutcome.Passthrough };
			}

			const resolved = ctx.app.metadataCache.getFirstLinkpathDest(
				payload.linkContent,
				activeFile.path,
			);
			if (resolved) {
				return { outcome: HandlerOutcome.Passthrough };
			}

			// 3. Look up corename in library tree
			const matches = librarian.findMatchingLeavesByCoreName(
				payload.linkContent,
			);
			if (matches.length === 0) {
				return { outcome: HandlerOutcome.Passthrough };
			}

			const currentPathParts = activeFile.path.split("/");
			// Drop filename to get folder path parts
			currentPathParts.pop();

			const best =
				matches.length === 1
					? matches[0]!
					: pickClosestLeaf(matches, currentPathParts);

			return {
				data: {
					...payload,
					aliasToInsert: payload.linkContent,
					resolvedTarget: best.basename,
				},
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}
