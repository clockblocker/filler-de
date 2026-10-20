import { splitPathCodec } from "../../split-path-codec";
import type { VaultFileStat } from "../../types/file-stat";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";

/** One Markdown file whose content changed outside VAM. */
export type MdFileModification = {
	readonly splitPath: SplitPathToMdFile;
	/** The file's stat when Obsidian reported the change. */
	readonly stat: VaultFileStat;
};

/**
 * Markdown modifications coalesced over one observation window.
 *
 * Modifications are hints that a file's content changed. Structural changes
 * (create, rename, delete) are reported only by `subscribeToBulk`, and the two
 * subscriptions are not ordered relative to each other.
 */
export type BulkMdModifyEvent = {
	/** One entry per modified file, in first-observed order, with its latest stat. */
	readonly modifications: readonly MdFileModification[];
	readonly debug: {
		/** Timestamp (ms since epoch) of the window's first accepted callback. */
		readonly startedAt: number;
		/** Timestamp (ms since epoch) when the window was finalized. */
		readonly endedAt: number;
		/** Callbacks accepted into the window, before coalescing and scoping. */
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

/** Restricts a bulk event to files below `folder`; `null` when none remain. */
export function scopeMdModifyEvent(
	event: BulkMdModifyEvent,
	folder: SplitPathToFolder,
): BulkMdModifyEvent | null {
	const prefix = splitPathCodec.format(folder).replace(/^\/+|\/+$/g, "");
	const modifications = event.modifications.filter(
		({ splitPath }) =>
			prefix === "" ||
			splitPathCodec.format(splitPath).startsWith(`${prefix}/`),
	);
	if (modifications.length === 0) return null;
	return { debug: event.debug, modifications };
}
