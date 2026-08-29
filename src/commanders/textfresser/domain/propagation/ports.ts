import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
	VamEffectError,
	VaultAction,
} from "@textfresser/vault-action-manager";
import type { Effect } from "effect";

export type ReadManyMdFilesOutcome =
	| {
			kind: "Found";
			splitPath: SplitPathToMdFile;
			content: string;
	  }
	| {
			kind: "Missing";
			splitPath: SplitPathToMdFile;
	  }
	| {
			kind: "Error";
			splitPath: SplitPathToMdFile;
			reason: VamEffectError;
	  };

export type FindCandidateTargetsParams = {
	basename: string;
	folder?: SplitPathToFolder;
};

type BuildTargetWriteActionsParams = {
	splitPath: SplitPathToMdFile;
	transform: (content: string) => string;
};

export interface PropagationVaultPort {
	readNoteOrEmpty(
		splitPath: SplitPathToMdFile,
	): Effect.Effect<string, string>;
	readManyMdFiles(
		paths: ReadonlyArray<SplitPathToMdFile>,
	): Effect.Effect<ReadonlyArray<ReadManyMdFilesOutcome>>;
	findCandidateTargets(
		params: FindCandidateTargetsParams,
	): Effect.Effect<ReadonlyArray<SplitPathToMdFile>, VamEffectError>;
	exists(path: AnySplitPath): Effect.Effect<boolean, VamEffectError>;
	buildTargetWriteActions(
		params: BuildTargetWriteActionsParams,
	): readonly VaultAction[];
}

export interface PropagationLibraryLookupPort {
	findByLeafCoreName(coreName: string): ReadonlyArray<SplitPathToMdFile>;
}
