import type { Effect } from "effect";
import type { VamFileReadError, VamScanError } from "./effect/errors";
import type { VamRuntimeFailure } from "./effect/services";
import type { VaultFileStat } from "./types/file-stat";
import type { SplitPathToFile, SplitPathToMdFile } from "./types/split-path";

export type VaultScanReadableMdPath = SplitPathToMdFile & {
	readonly read: () => Effect.Effect<
		string,
		VamRuntimeFailure<VamFileReadError>
	>;
};

export type VaultScanPath = VaultScanReadableMdPath | SplitPathToFile;

/**
 * A `scanWithStat` entry. The stat is a separate field so consumers that
 * spread entries into Split Paths opt in explicitly.
 */
export type VaultScanPathWithStat = VaultScanPath & {
	/** The file's stat when the scan visited it. */
	readonly stat: VaultFileStat;
};

export type VaultScanCounts = {
	readonly folderCount: number;
	readonly markdownFileCount: number;
	readonly otherFileCount: number;
};

type VaultScanResultBase<Entry> = {
	readonly counts: VaultScanCounts;
	readonly entries: readonly Entry[];
};

export type VaultScanResult<Entry extends VaultScanPath = VaultScanPath> =
	| (VaultScanResultBase<Entry> & {
			readonly diagnostics: readonly [];
			readonly kind: "Complete";
	  })
	| (VaultScanResultBase<Entry> & {
			readonly diagnostics: readonly [VamScanError, ...VamScanError[]];
			readonly kind: "Partial";
	  });

declare const VaultCursorBrand: unique symbol;

/**
 * A place in the order of the vault callbacks Obsidian fired: everything up
 * to it, and nothing after. Cursors of one VAM compare as numbers.
 */
export type VaultCursor = number & { readonly [VaultCursorBrand]: true };

/**
 * What the vault held below a folder at `cursor`, as `scanWithStat` lists
 * it: files with their stats, folders counted. It comes from Obsidian's
 * in-memory tree, read on the tick the cursor was. Content is not part of
 * it: a Markdown entry's `read` reads the file when called, so it is at
 * least as new as the snapshot and may already show a change after it.
 */
export type VaultSnapshot = VaultScanResult<VaultScanPathWithStat> & {
	readonly cursor: VaultCursor;
};
