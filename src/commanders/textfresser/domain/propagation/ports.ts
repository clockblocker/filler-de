import type { Result } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../managers/obsidian/vault-action-manager/types/split-path";

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
			reason: string;
	  };

export type FindCandidateTargetsParams = {
	basename: string;
	folder?: SplitPathToFolder;
};

export type BuildTargetWriteActionsParams = {
	splitPath: SplitPathToMdFile;
	transform: (content: string) => string;
};

export interface PropagationVaultPort {
	readNoteOrEmpty(
		splitPath: SplitPathToMdFile,
	): Promise<Result<string, string>>;
	readManyMdFiles(
		paths: ReadonlyArray<SplitPathToMdFile>,
	): Promise<ReadonlyArray<ReadManyMdFilesOutcome>>;
	findCandidateTargets(
		params: FindCandidateTargetsParams,
	): ReadonlyArray<SplitPathToMdFile>;
	exists(path: AnySplitPath): boolean;
	buildTargetWriteActions(
		params: BuildTargetWriteActionsParams,
	): readonly VaultAction[];
}

export interface PropagationLibraryLookupPort {
	findByLeafCoreName(coreName: string): ReadonlyArray<SplitPathToMdFile>;
}
