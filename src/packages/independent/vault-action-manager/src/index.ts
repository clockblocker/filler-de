import type { Result } from "neverthrow";
import type { ActiveFileService } from "./file-services/active-view/active-file-service";
import type { SelectionService } from "./file-services/active-view/selection-service";
import type { DispatchResult } from "./impl/actions-processing/dispatcher";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
import {
	buildDependencyGraph,
	makeGraphKey,
} from "./impl/actions-processing/dependency-detector";
import { topologicalSort } from "./impl/actions-processing/topological-sort";
import { VaultReader } from "./impl/vault-reader";
import type { ReadContentError } from "./types/read-content-error";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";
import type { VaultEvent } from "./types/vault-event";

export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export { type VaultAction, VaultActionKind } from "./types/vault-action";
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
	readContent(
		splitPath: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>>;
	exists(splitPath: AnySplitPath): boolean;
	findByBasename(
		basename: string,
		opts?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[];
	resolveLinkpathDest(
		linkpath: string,
		from: SplitPathToMdFile,
	): SplitPathToMdFile | null;
	isInActiveView(splitPath: AnySplitPath): boolean;
	list(splitPath: SplitPathToFolder): Result<AnySplitPath[], string>;
	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Result<SplitPathWithReader[], string>;
	pwd(): Result<SplitPathToAnyFile, string>;
	mdPwd(): SplitPathToMdFile | null;

	// Opened file operations (high-level, no TFile leakage)
	getOpenedContent(): Result<string, string>;
	cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>>;

	// Direct access to active file service for selection operations
	readonly activeFileService: ActiveFileService;

	// Selection operations
	readonly selection: SelectionService;
}

export { makeSystemPathForSplitPath };
export { makeSplitPath };
export { TFileHelper, TFolderHelper, VaultReader };
export { buildDependencyGraph, makeGraphKey, topologicalSort };

export { VaultActionManagerImpl } from "./facade";
export * from "./helpers/issue-handlers";
export * from "./helpers/pathfinder";
export {
	ActiveFileService,
	type SavedInlineTitleSelection,
	type SavedSelection,
} from "./file-services/active-view/active-file-service";
export type { SelectionInfo } from "./file-services/active-view/selection-service";
export type { SelectionService } from "./file-services/active-view/selection-service";
export type {
	DebugTraceEntry,
	DispatchError,
	DispatcherDebugState,
	DispatchResult,
} from "./impl/actions-processing/dispatcher";
export type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
export * from "./types/literals";
export {
	classifyReadContentError,
	isReadContentFileNotFound,
	type ReadContentError,
	ReadContentErrorKind,
	readContentErrorToReason,
} from "./types/read-content-error";
export * from "./types/split-path";
export * from "./types/vault-action";
export * from "./types/vault-event";
