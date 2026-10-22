import { Effect } from "effect";
import { ActiveEditorAccess } from "../../effect/ports";
import { splitPathCodec } from "../../split-path-codec";
import type { ProtectedPaths } from "../protected-paths";
import type { BulkMdModifyEvent, MdFileModification } from "./md-modify-event";

/**
 * Who most likely changed a protected file:
 *
 * - `VamRenameLinkUpdate`: its origin is `LinkUpdate`, so Obsidian's link
 *   updater rewrote it on VAM's behalf.
 * - `OpenInEditor`: the file is shown in a Markdown view, so this is most
 *   likely the user's own editing.
 * - `Unattributed`: neither, for example Obsidian's link updater after the
 *   user's own rename, Obsidian Sync, or another plugin.
 *
 * `VamRenameLinkUpdate` wins over `OpenInEditor`, so a rewrite of an open
 * protected file after a VAM rename is still reported as one. VAM never
 * writes a protected path, so a modification labelled VAM's own is a
 * misattribution and counts as `Unattributed`.
 */
export type ProtectedModificationWriter =
	| "VamRenameLinkUpdate"
	| "OpenInEditor"
	| "Unattributed";

/** One modification of a file under a protected prefix. */
export type ProtectedPathModification = MdFileModification & {
	/** The protected prefix the file lies under. */
	readonly prefix: string;
	readonly writer: ProtectedModificationWriter;
};

/** The protected modifications of one Markdown modify window. */
export type ProtectedPathModificationsEvent = {
	readonly modifications: readonly ProtectedPathModification[];
};

/**
 * The modifications of `event` under a protected prefix, each with its most
 * likely writer; `null` when none. A failed editor lookup leaves files
 * `Unattributed`, so it can only add warnings, never hide one.
 */
export const classifyProtectedModifications = Effect.fnUntraced(function* (
	event: BulkMdModifyEvent,
	protectedPaths: ProtectedPaths,
): Effect.fn.Return<
	ProtectedPathModificationsEvent | null,
	never,
	ActiveEditorAccess
> {
	const candidates = event.modifications.flatMap((modification) => {
		const prefix = protectedPaths.prefixCovering(
			splitPathCodec.format(modification.splitPath),
		);
		return prefix === undefined ? [] : [{ modification, prefix }];
	});
	if (candidates.length === 0) return null;

	const access = yield* ActiveEditorAccess;
	const openPaths = yield* access.openMarkdownPaths.pipe(
		Effect.orElseSucceed((): ReadonlySet<string> => new Set()),
	);

	const modifications = candidates.map(
		({ modification, prefix }): ProtectedPathModification => ({
			...modification,
			prefix,
			writer:
				modification.origin.kind === "LinkUpdate"
					? "VamRenameLinkUpdate"
					: modification.origin.kind === "External" &&
							openPaths.has(
								splitPathCodec.format(modification.splitPath),
							)
						? "OpenInEditor"
						: "Unattributed",
		}),
	);
	return { modifications };
});
