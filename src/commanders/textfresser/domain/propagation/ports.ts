import type { VaultAction } from "@textfresser/vault-action-manager";
import type { ReadContentError } from "@textfresser/vault-action-manager";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import type { Result } from "neverthrow";

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
			reason: ReadContentError;
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
