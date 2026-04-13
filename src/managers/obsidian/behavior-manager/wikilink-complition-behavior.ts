/**
 * Thin handler for wikilink completion.
 * Delegates to Librarian for alias resolution and corename auto-resolution.
 *
 * Resolution order:
 * 1. Suffix-based alias (existing files with suffix → show alias)
 * 2. Obsidian can resolve the link → passthrough
 * 3. Corename lookup in tree → replace target with suffixed basename + alias
 */

import type { LeafMatch } from "@textfresser/library-core";
import { nonEmptyArrayResult } from "../../../types/utils";
import {
	type UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { pickClosestLeaf } from "./pick-closest-leaf";

type WikilinkCompletionLibrarianPort = {
	resolveWikilinkAlias(linkContent: string): string | null;
	findMatchingLeavesByCoreName(coreName: string): LeafMatch[];
};

/**
 * Create a handler for wikilink completion.
 * Thin routing layer - delegates to librarian methods.
 */
export function createWikilinkCompletionHandler(
	librarian: WikilinkCompletionLibrarianPort,
): UserEventHandler<typeof UserEventKind.WikilinkCompleted> {
	return {
		doesApply: () => true,
		handle: (payload) => {
			// 1. Try suffix-based alias resolution (existing behavior)
			const alias = librarian.resolveWikilinkAlias(payload.linkContent);
			if (alias !== null) {
				return {
					effect: { aliasToInsert: alias },
					outcome: "effect",
				};
			}

			// 2. Check if Obsidian can already resolve this link
			if (payload.canResolveNatively) {
				return { outcome: "passthrough" } as const;
			}

			// 3. Look up corename in library tree
			const matches = librarian.findMatchingLeavesByCoreName(
				payload.linkContent,
			);
			const nonEmpty = nonEmptyArrayResult(matches);
			if (nonEmpty.isErr()) {
				return { outcome: "passthrough" } as const;
			}
			// Ambiguous corename match: do not auto-pick one leaf target.
			// Keep user's input untouched to avoid silent mislinking.
			if (nonEmpty.value.length > 1) {
				return { outcome: "passthrough" } as const;
			}

			const currentPathParts = payload.sourcePath?.split("/") ?? [];
			// Drop filename to get folder path parts
			currentPathParts.pop();

			const best = pickClosestLeaf(nonEmpty.value, currentPathParts);

			return {
				effect: {
					aliasToInsert: payload.linkContent,
					resolvedTarget: best.basename,
				},
				outcome: "effect",
			};
		},
	};
}
