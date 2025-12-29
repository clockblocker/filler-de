import type { Result } from "neverthrow";
import type { TFile, TFolder } from "obsidian";
import { z } from "zod";
import type { DispatchResult } from "./impl/dispatcher";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/split-path-and-system-path";
import { CREATE, FILE, FOLDER, RENAME, TRASH } from "./types/literals";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export const VaultEventTypeSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${TRASH}ed`,
	`${FOLDER}${CREATE}d`,
	`${FOLDER}${RENAME}d`,
	`${FOLDER}${TRASH}ed`,
] as const);

export const VaultEventType = VaultEventTypeSchema.enum;
export type VaultEventType = z.infer<typeof VaultEventTypeSchema>;

export type VaultEvent =
	| {
			type: typeof VaultEventType.FileCreated;
			splitPath: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FileRenamed;
			from: SplitPathToFile | SplitPathToMdFile;
			to: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FileTrashed;
			splitPath: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FolderCreated;
			splitPath: SplitPathToFolder;
	  }
	| {
			type: typeof VaultEventType.FolderRenamed;
			from: SplitPathToFolder;
			to: SplitPathToFolder;
	  }
	| {
			type: typeof VaultEventType.FolderTrashed;
			splitPath: SplitPathToFolder;
	  };

export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk-vault-event";

export type VaultEventHandler = (event: VaultEvent) => Promise<void>;

export type Teardown = () => void;

export interface ObsidianVaultActionManager {
	startListening(): void;
	subscribe(handler: VaultEventHandler): Teardown;
	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;

	// Read-only operations
	readContent(splitPath: SplitPathToMdFile): Promise<Result<string, string>>;
	exists(splitPath: SplitPath): Promise<boolean>;
	isInActiveView(splitPath: SplitPath): Promise<boolean>;
	list(splitPath: SplitPathToFolder): Promise<Result<SplitPath[], string>>;
	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Promise<Result<SplitPathWithReader[], string>>;
	pwd(): Promise<Result<SplitPathToFile | SplitPathToMdFile, string>>;

	getAbstractFile<SP extends SplitPath>(
		splitPath: SP,
	): Promise<Result<SP["type"] extends "Folder" ? TFolder : TFile, string>>;
}

export { makeSystemPathForSplitPath };
export { makeSplitPath };

export { ObsidianVaultActionManagerImpl } from "./facade";
export type { DispatchError, DispatchResult } from "./impl/dispatcher";
