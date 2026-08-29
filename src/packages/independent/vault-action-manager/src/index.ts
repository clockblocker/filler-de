import type { Result } from "neverthrow";
import type { SelectionInfo } from "./file-services/active-view/selection-service";
import type { DispatchResult } from "./impl/actions-processing/dispatch-batch";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { ReadContentError } from "./types/read-content-error";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export type { BulkVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
export { type VaultAction, VaultActionKind } from "./types/vault-action";
export { type VaultEvent, VaultEventKind } from "./types/vault-event";

export type BulkVaultEventHandler = (event: BulkVaultEvent) => Promise<void>;

export type Teardown = () => void;

export interface VaultActionManager {
	startListening(): void;

	subscribeToBulk(handler: BulkVaultEventHandler): Teardown;

	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;

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
	list(splitPath: SplitPathToFolder): Result<AnySplitPath[], string>;
	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Result<SplitPathWithReader[], string>;
	mdPwd(): SplitPathToMdFile | null;

	// Opened file operations (high-level, no TFile leakage)
	getOpenedContent(): Result<string, string>;
	getSelectionInfo(): SelectionInfo | null;
	getSelectionText(): string | null;
	cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>>;
	scrollOpenedFileToLine(line: number): void;
}

export { makeSystemPathForSplitPath };
export { makeSplitPath };

export { createVaultActionManager } from "./facade";
export type { SelectionInfo } from "./file-services/active-view/selection-service";
export * from "./helpers/issue-handlers";
export * from "./helpers/pathfinder";
export type {
	DispatchError,
	DispatchResult,
} from "./impl/actions-processing/dispatch-batch";
export type { PossibleRootVaultEvent } from "./impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
export { VaultActionManagerTestingAdapter } from "./testing-adapter";
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
