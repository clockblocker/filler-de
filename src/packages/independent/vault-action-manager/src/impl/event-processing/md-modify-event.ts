import { splitPathCodec } from "../../split-path-codec";
import type { VaultEventOrigin } from "../../types/event-origin";
import type { VaultFileStat } from "../../types/file-stat";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import { VaultPath } from "../../vault-path";
import type { ObservationScope } from "./vault-observation";

/** One Markdown file whose content changed, as Obsidian reported it. */
export type MdFileChange = {
	readonly splitPath: SplitPathToMdFile;
	/** The file's stat when Obsidian reported the change. */
	readonly stat: VaultFileStat;
};

/** One Markdown file whose content changed, and who changed it last. */
export type MdFileModification = MdFileChange & {
	readonly origin: VaultEventOrigin;
};

/**
 * Markdown modifications coalesced over one observation window.
 *
 * Modifications are hints that a file's content changed. Structural changes
 * (create, rename, delete) are reported only by `subscribeToBulk`, and the two
 * subscriptions are not ordered relative to each other.
 */
export type BulkMdModifyEvent = {
	/**
	 * One entry per modified file, in first-observed order, with its latest
	 * stat and the origin of its latest change the subscription receives.
	 */
	readonly modifications: readonly MdFileModification[];
	readonly debug: {
		/** Timestamp (ms since epoch) of the window's first accepted callback. */
		readonly startedAt: number;
		/** Timestamp (ms since epoch) when the window was finalized. */
		readonly endedAt: number;
		/**
		 * Callbacks accepted into the window that the subscription receives,
		 * of its origins and below its folder, before coalescing.
		 */
		readonly trueCount: number;
	};
};

export function coalesceMdModifications(
	modifications: readonly MdFileModification[],
): MdFileModification[] {
	const byPath = new Map<string, MdFileModification>();
	for (const modification of modifications) {
		byPath.set(splitPathCodec.format(modification.splitPath), modification);
	}
	return [...byPath.values()];
}

/**
 * The Markdown changes below `folder`, as `scopeMdModifyEvent` keeps them:
 * a subscription scoped to them is not delivered a window without one.
 */
export function mdChangesBelow(
	folder: SplitPathToFolder,
): ObservationScope<MdFileChange> {
	const prefix = splitPathCodec.format(folder);
	return {
		accepts: ({ splitPath }) =>
			VaultPath.caseSensitive.isUnder(
				splitPathCodec.format(splitPath),
				prefix,
				{ inclusive: false },
			),
		key: `below:${VaultPath.caseSensitive.key(prefix)}`,
	};
}

/**
 * Restricts a bulk event to files below `folder`; `null` when none remain.
 * Case-sensitive, as Obsidian reports a path and as a subscriber keys it.
 */
export function scopeMdModifyEvent(
	event: BulkMdModifyEvent,
	folder: SplitPathToFolder,
): BulkMdModifyEvent | null {
	const prefix = splitPathCodec.format(folder);
	const modifications = event.modifications.filter(({ splitPath }) =>
		VaultPath.caseSensitive.isUnder(
			splitPathCodec.format(splitPath),
			prefix,
			{ inclusive: false },
		),
	);
	if (modifications.length === 0) return null;
	return { debug: event.debug, modifications };
}
