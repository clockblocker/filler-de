/**
 * Thin handler for wikilink completion: a link the user wraps in `[[ ]]` or
 * closes with `]]` by hand.
 *
 * **Crossroad landing** (ADR-0015, #115). In a note outside `Worter/`, a
 * bare word lands on its spelling's Crossroad note: `[[Fahrer]]` becomes
 * `[[Worter/f/fah/fahre/fahrer|Fahrer]]` (`crossroadNotePath`, keyed by
 * dumling's `canonicalFormKey`), whether or not the note exists yet, since
 * a click on the uncreated link creates it at that path. A link is bare when
 * it has no path (`/`), heading or block (`#`), `.md` extension or alias
 * (`|`, which the detector skips), holds a letter or digit, and is no embed.
 *
 * A bare link is left to the Library's rules instead when it names a note
 * that is not the dictionary's:
 *
 * - Obsidian resolves it to a note outside `Worter/`, such as a Scroll or
 *   any other note of the vault;
 * - it resolves nowhere, and the Library tree holds leaves with that core
 *   name.
 *
 * A link Obsidian resolves into `Worter/`, to a Crossroad, a Lemma note or a
 * stray, is the dictionary's, and lands on the Crossroad path too.
 *
 * **Library rules**, in every other case, unchanged:
 * 1. Suffix-based alias (existing files with suffix → show alias)
 * 2. Obsidian can resolve the link → passthrough
 * 3. Corename lookup in tree → replace target with suffixed basename + alias
 */

import {
	crossroadNotePath,
	WORTER_FOLDER,
} from "@textfresser/lemma-note-codec";
import type { LeafMatch } from "@textfresser/library-core";
import type {
	PayloadFor,
	UserEventHandler,
	UserEventKind,
	UserEventResult,
} from "@textfresser/obsidian-event-layer";
import { VaultPath } from "@textfresser/vault-action-manager";
import { Result as EffectResult } from "effect";
import { nonEmptyArrayResult } from "../../../types/utils";
import { pickClosestLeaf } from "./pick-closest-leaf";

type WikilinkCompletionLibrarianPort = {
	resolveWikilinkAlias(linkContent: string): string | null;
	findMatchingLeavesByCoreName(coreName: string): LeafMatch[];
};

type Payload = PayloadFor<"WikilinkCompleted">;
type Result = UserEventResult<typeof UserEventKind.WikilinkCompleted>;

const PASSTHROUGH = { outcome: "passthrough" } as const;

/** Whether a vault path is the dictionary's folder or below it. */
const inWorter = (path: string): boolean =>
	VaultPath.caseSensitive.isUnder(path, WORTER_FOLDER, { inclusive: true });

/**
 * A link naming only a note, by a word: no path, subpath or extension, and
 * at least one letter or digit.
 */
const isBare = (linkContent: string): boolean =>
	!/[/#|]/u.test(linkContent) &&
	!/\.md$/iu.test(linkContent) &&
	/[\p{L}\p{N}]/u.test(linkContent);

/**
 * The Crossroad path to land a link on, without `.md`, or undefined when
 * the link is not a bare word in a note outside `Worter/`, or its spelling
 * has no Crossroad path.
 */
function crossroadTargetOf(payload: Payload): string | undefined {
	const { embed, linkContent, sourcePath } = payload;
	if (sourcePath === undefined || inWorter(sourcePath)) return undefined;
	if (embed || !isBare(linkContent)) return undefined;
	try {
		return crossroadNotePath(linkContent, "de").path.slice(
			0,
			-".md".length,
		);
	} catch {
		return undefined;
	}
}

/** The Library's rules: suffix alias, native resolution, then core name. */
function libraryCompletion(
	librarian: WikilinkCompletionLibrarianPort,
	payload: Payload,
): Result {
	// 1. Try suffix-based alias resolution (existing behavior)
	const alias = librarian.resolveWikilinkAlias(payload.linkContent);
	if (alias !== null) {
		return {
			effect: { aliasToInsert: alias },
			outcome: "effect",
		};
	}

	// 2. Check if Obsidian can already resolve this link
	if (payload.resolvedPath !== undefined) return PASSTHROUGH;

	// 3. Look up corename in library tree
	const matches = librarian.findMatchingLeavesByCoreName(payload.linkContent);
	const nonEmpty = nonEmptyArrayResult(matches);
	if (EffectResult.isFailure(nonEmpty)) return PASSTHROUGH;
	// Ambiguous corename match: do not auto-pick one leaf target.
	// Keep user's input untouched to avoid silent mislinking.
	if (nonEmpty.success.length > 1) return PASSTHROUGH;

	const currentPathParts = payload.sourcePath?.split("/") ?? [];
	// Drop filename to get folder path parts
	currentPathParts.pop();

	const best = pickClosestLeaf(nonEmpty.success, currentPathParts);

	return {
		effect: {
			aliasToInsert: payload.linkContent,
			resolvedTarget: best.basename,
		},
		outcome: "effect",
	};
}

/**
 * Whether a link names a note that is not the dictionary's: one Obsidian
 * resolves it to outside `Worter/`, or, when it resolves nowhere, a Library
 * leaf by core name.
 */
function namesAnotherNote(
	librarian: WikilinkCompletionLibrarianPort,
	payload: Payload,
): boolean {
	if (payload.resolvedPath !== undefined)
		return !inWorter(payload.resolvedPath);
	return (
		librarian.findMatchingLeavesByCoreName(payload.linkContent).length > 0
	);
}

/**
 * Create a handler for wikilink completion.
 * Thin routing layer - delegates Library lookups to librarian methods.
 */
export function createWikilinkCompletionHandler(
	librarian: WikilinkCompletionLibrarianPort,
): UserEventHandler<typeof UserEventKind.WikilinkCompleted> {
	return {
		doesApply: () => true,
		handle: (payload) => {
			const crossroad = crossroadTargetOf(payload);
			if (crossroad === undefined || namesAnotherNote(librarian, payload))
				return libraryCompletion(librarian, payload);
			return {
				effect: {
					aliasToInsert: payload.linkContent,
					resolvedTarget: crossroad,
				},
				outcome: "effect",
			};
		},
	};
}
