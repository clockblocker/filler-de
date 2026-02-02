import type { Result } from "neverthrow";
import type { TFile, TFolder } from "obsidian";
import type { OpenedFileService } from "./file-services/active-view/writer/opened-file-writer";
import type { DispatchResult } from "./impl/actions-processing/dispatcher";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";
import type { VaultEvent } from "./types/vault-event";

export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export type { VaultAction } from "./types/vault-action";
export { type VaultEvent, VaultEventKind } from "./types/vault-event";

export type VaultEventHandler = (event: VaultEvent) => Promise<void>;
export type BulkVaultEventHandler = (event: BulkVaultEvent) => Promise<void>;

export type Teardown = () => void;

export interface VaultActionManager {
	startListening(): void;

	subscribeToSingle(handler: VaultEventHandler): Teardown;
	subscribeToBulk(handler: BulkVaultEventHandler): Teardown;

	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;

	/**
	 * Wait until all registered paths have been processed by Obsidian (via events).
	 * Used to ensure files are visible before subsequent operations.
	 */
	waitForObsidianEvents(): Promise<void>;

	// Read-only operations
	readContent(splitPath: SplitPathToMdFile): Promise<Result<string, string>>;
	exists(splitPath: AnySplitPath): Promise<boolean>;
	isInActiveView(splitPath: AnySplitPath): boolean;
	list(splitPath: SplitPathToFolder): Promise<Result<AnySplitPath[], string>>;
	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Promise<Result<SplitPathWithReader[], string>>;
	pwd(): Promise<Result<SplitPathToFile | SplitPathToMdFile, string>>;
	mdPwd(): Promise<SplitPathToMdFile | null>;

	getAbstractFile<SP extends AnySplitPath>(
		splitPath: SP,
	): Promise<Result<SP["kind"] extends "Folder" ? TFolder : TFile, string>>;

	// Opened file operations (high-level, no TFile leakage)
	getOpenedFileName(): Promise<Result<string, string>>;
	getOpenedContent(): Result<string, string>;
	replaceOpenedContent(content: string): Result<string, string>;
	cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>>;

	// Direct access to opened file service for selection operations
	readonly openedFileService: OpenedFileService;
}

export { makeSystemPathForSplitPath };
export { makeSplitPath };

export { VaultActionManagerImpl } from "./facade";
export type {
	DebugTraceEntry,
	DispatchError,
	DispatcherDebugState,
	DispatchResult,
} from "./impl/actions-processing/dispatcher";
