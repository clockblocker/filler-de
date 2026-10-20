import type { Effect } from "effect";
import type { VamFileAccessError, VamScanError } from "./effect/errors";
import type { VamRuntimeFailure } from "./effect/runtime";
import type { VaultFileStat } from "./types/file-stat";
import type { SplitPathToFile, SplitPathToMdFile } from "./types/split-path";

export type VaultScanReadableMdPath = SplitPathToMdFile & {
	readonly read: () => Effect.Effect<
		string,
		VamRuntimeFailure<VamFileAccessError>
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
