import type { Result } from "neverthrow";
import type { TFile, TFolder } from "obsidian";
import type { DispatchResult } from "./impl/actions-processing/dispatcher";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";
import type { VaultEvent } from "./types/vault-event";

export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export { type VaultEvent, VaultEventType } from "./types/vault-event";

export type VaultEventHandler = (event: VaultEvent) => Promise<void>;
export type BulkVaultEventHandler = (event: BulkVaultEvent) => Promise<void>;

export type Teardown = () => void;

export interface ObsidianVaultActionManager {
	startListening(): void;

	subscribeToSingle(handler: VaultEventHandler): Teardown;
	subscribeToBulk(handler: BulkVaultEventHandler): Teardown;

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
export type {
	DispatchError,
	DispatchResult,
} from "./impl/actions-processing/dispatcher";
