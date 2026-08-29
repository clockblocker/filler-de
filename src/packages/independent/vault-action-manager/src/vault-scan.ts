import type { Effect } from "effect";
import type { VamFileAccessError, VamScanError } from "./effect/errors";
import type { VamRuntimeFailure } from "./effect/runtime";
import type { SplitPathToFile, SplitPathToMdFile } from "./types/split-path";

export type VaultScanReadableMdPath = SplitPathToMdFile & {
	readonly read: () => Effect.Effect<
		string,
		VamRuntimeFailure<VamFileAccessError>
	>;
};

export type VaultScanPath = VaultScanReadableMdPath | SplitPathToFile;

export type VaultScanCounts = {
	readonly folderCount: number;
	readonly markdownFileCount: number;
	readonly otherFileCount: number;
};

type VaultScanResultBase = {
	readonly counts: VaultScanCounts;
	readonly entries: readonly VaultScanPath[];
};

export type VaultScanResult =
	| (VaultScanResultBase & {
			readonly diagnostics: readonly [];
			readonly kind: "Complete";
	  })
	| (VaultScanResultBase & {
			readonly diagnostics: readonly [VamScanError, ...VamScanError[]];
			readonly kind: "Partial";
	  });
