import { Effect } from "effect";
import { ActiveEditorAccess } from "../../effect/ports";
import { splitPathCodec } from "../../split-path-codec";
import type { ProtectedPaths } from "../protected-paths";
import type { LinkUpdates } from "./link-updates";
import type { BulkMdModifyEvent, MdFileModification } from "./md-modify-event";

/**
 * Who most likely changed a protected file:
 *
 * - `RestoredAfterLinkUpdate`: Obsidian's link updater rewrote it after a
 *   VAM rename, VAM predicted that and put the file back as it was. Its
 *   content is unchanged; its links to the renamed entry keep their old
 *   text, which may no longer resolve.
 * - `VamRenameLinkUpdate`: Obsidian's link updater rewrote it after a VAM
 *   rename, and VAM did not put it back: the rewrite was not predicted, or
 *   the file changed again before VAM could.
 * - `OpenInEditor`: the file is shown in a Markdown view, so this is most
 *   likely the user's own editing.
 * - `Unattributed`: none of these, for example Obsidian's link updater after
 *   the user's own rename, Obsidian Sync, or another plugin.
 *
 * The link-update writers win over `OpenInEditor`, so a rewrite of an open
 * protected file after a VAM rename is still reported as one. VAM writes a
 * protected path only to put it back, so any other modification labelled
 * VAM's own is a misattribution and counts as `Unattributed`.
 */
export type ProtectedModificationWriter =
	| "RestoredAfterLinkUpdate"
	| "VamRenameLinkUpdate"
	| "OpenInEditor"
	| "Unattributed";

/** One modification of a file under a protected prefix. */
export type ProtectedPathModification = MdFileModification & {
	/** The protected prefix the file lies under. */
	readonly prefix: string;
	readonly writer: ProtectedModificationWriter;
	/**
	 * For `RestoredAfterLinkUpdate`, the rename whose links the file held:
	 * the renamed entry's path before and after.
	 */
	readonly renamed?: { readonly from: string; readonly to: string };
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
	linkUpdates: LinkUpdates,
): Effect.fn.Return<
	ProtectedPathModificationsEvent | null,
	never,
	ActiveEditorAccess
> {
	const candidates = event.modifications.flatMap((modification) => {
		const path = splitPathCodec.format(modification.splitPath);
		const prefix = protectedPaths.prefixCovering(path);
		return prefix === undefined ? [] : [{ modification, path, prefix }];
	});
	if (candidates.length === 0) return null;

	const access = yield* ActiveEditorAccess;
	const openPaths = yield* access.openMarkdownPaths.pipe(
		Effect.orElseSucceed((): ReadonlySet<string> => new Set()),
	);

	const modifications: ProtectedPathModification[] = [];
	for (const { modification, path, prefix } of candidates) {
		const { origin } = modification;
		// A restored file's window ends with VAM's own write, or with the
		// predicted rewrite when that write fell in the next window. A timed
		// `LinkUpdate` is a write VAM did not predict, so it is reported as
		// a change even after a restoration of the same operation.
		const restoration =
			origin.kind === "Vam" ||
			(origin.kind === "LinkUpdate" && origin.basis === "Predicted")
				? yield* linkUpdates.restorationOf(path, origin.operationId)
				: undefined;
		if (restoration !== undefined) {
			modifications.push({
				...modification,
				prefix,
				renamed: { from: restoration.from, to: restoration.to },
				writer: "RestoredAfterLinkUpdate",
			});
			continue;
		}
		modifications.push({
			...modification,
			prefix,
			writer:
				origin.kind === "LinkUpdate"
					? "VamRenameLinkUpdate"
					: origin.kind === "External" && openPaths.has(path)
						? "OpenInEditor"
						: "Unattributed",
		});
	}
	return { modifications };
});
