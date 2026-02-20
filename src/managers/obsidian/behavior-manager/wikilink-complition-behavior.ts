/**
 * Thin handler for wikilink completion.
 * Delegates to Librarian for alias resolution and corename auto-resolution.
 *
 * Resolution order:
 * 1. Suffix-based alias (existing files with suffix → show alias)
 * 2. Obsidian can resolve the link → passthrough
 * 3. Corename lookup in tree → replace target with suffixed basename + alias
 */

import type { LeafMatch } from "../../../commanders/librarian/healer/library-tree/types/leaf-match";
import { nonEmptyArrayResult } from "../../../types/utils";
import type { WikilinkPayload } from "../user-event-interceptor/events/wikilink/payload";
import { pickClosestLeaf } from "./pick-closest-leaf";

type WikilinkCompletionLibrarianPort = {
	resolveWikilinkAlias(linkContent: string): string | null;
	findMatchingLeavesByCoreName(coreName: string): LeafMatch[];
};

type MinimalWikilinkHandlerContext = {
	app: {
		metadataCache: {
			getFirstLinkpathDest: (
				linkpath: string,
				sourcePath: string,
			) => unknown | null;
		};
		workspace: {
			getActiveFile: () => { path: string } | null;
		};
	};
};

type WikilinkCompletionOutcome =
	| { outcome: "Passthrough" }
	| { outcome: "Modified"; data: WikilinkPayload };

type WikilinkCompletionHandler = {
	doesApply: (payload: WikilinkPayload) => boolean;
	handle: (
		payload: WikilinkPayload,
		ctx: MinimalWikilinkHandlerContext,
	) => WikilinkCompletionOutcome;
};

/**
 * Create a handler for wikilink completion.
 * Thin routing layer - delegates to librarian methods.
 */
export function createWikilinkCompletionHandler(
	librarian: WikilinkCompletionLibrarianPort,
): WikilinkCompletionHandler {
	return {
		doesApply: () => true,
		handle: (payload, ctx) => {
			// 1. Try suffix-based alias resolution (existing behavior)
			const alias = librarian.resolveWikilinkAlias(payload.linkContent);
			if (alias !== null) {
				return {
					data: { ...payload, aliasToInsert: alias },
					outcome: "Modified",
				};
			}

			// 2. Check if Obsidian can already resolve this link
			const activeFile = ctx.app.workspace.getActiveFile();
			if (!activeFile) {
				return { outcome: "Passthrough" };
			}

			const resolved = ctx.app.metadataCache.getFirstLinkpathDest(
				payload.linkContent,
				activeFile.path,
			);
			if (resolved) {
				return { outcome: "Passthrough" };
			}

			// 3. Look up corename in library tree
			const matches = librarian.findMatchingLeavesByCoreName(
				payload.linkContent,
			);
			const nonEmpty = nonEmptyArrayResult(matches);
			if (nonEmpty.isErr()) {
				return { outcome: "Passthrough" };
			}
			// Ambiguous corename match: do not auto-pick one leaf target.
			// Keep user's input untouched to avoid silent mislinking.
			if (nonEmpty.value.length > 1) {
				return { outcome: "Passthrough" };
			}

			const currentPathParts = activeFile.path.split("/");
			// Drop filename to get folder path parts
			currentPathParts.pop();

			const best = pickClosestLeaf(nonEmpty.value, currentPathParts);

			return {
				data: {
					...payload,
					aliasToInsert: payload.linkContent,
					resolvedTarget: best.basename,
				},
				outcome: "Modified",
			};
		},
	};
}
