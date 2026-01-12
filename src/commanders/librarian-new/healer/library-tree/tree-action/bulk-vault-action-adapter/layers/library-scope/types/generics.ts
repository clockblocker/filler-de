import type { VaultEvent } from "../../../../../../../../../managers/obsidian/vault-action-manager";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	VaultEventKind,
} from "../../../../../../../../../managers/obsidian/vault-action-manager/types/vault-event";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./inside-library-split-paths";
import type {
	LibraryScopedVaultEvent,
	ScopedFileCreatedVaultEventInside,
	ScopedFileCreatedVaultEventOutside,
	ScopedFileDeletedVaultEventInside,
	ScopedFileDeletedVaultEventOutside,
	ScopedFileRenamedVaultEventInside,
	ScopedFileRenamedVaultEventInsideToOutside,
	ScopedFileRenamedVaultEventOutside,
	ScopedFileRenamedVaultEventOutsideToInside,
	ScopedFolderCreatedVaultEventInside,
	ScopedFolderCreatedVaultEventOutside,
	ScopedFolderDeletedVaultEventInside,
	ScopedFolderDeletedVaultEventOutside,
	ScopedFolderRenamedVaultEventInside,
	ScopedFolderRenamedVaultEventInsideToOutside,
	ScopedFolderRenamedVaultEventOutside,
	ScopedFolderRenamedVaultEventOutsideToInside,
} from "./scoped-event";

export type DescopedSplitPath<T extends SplitPathInsideLibrary> =
	T extends SplitPathToFolderInsideLibrary
		? SplitPathToFolder
		: T extends SplitPathToMdFileInsideLibrary
			? SplitPathToMdFile
			: T extends SplitPathToFileInsideLibrary
				? SplitPathToFile
				: AnySplitPath;

export type EnscopedSplitPath<T extends AnySplitPath> =
	T extends SplitPathToFolder
		? SplitPathToFolderInsideLibrary
		: T extends SplitPathToMdFile
			? SplitPathToMdFileInsideLibrary
			: T extends SplitPathToFile
				? SplitPathToFileInsideLibrary
				: AnySplitPath;

// ---

export type EnscopedEvent<T extends VaultEvent> =
	T extends FolderCreatedVaultEvent
		?
				| ScopedFolderCreatedVaultEventInside
				| ScopedFolderCreatedVaultEventOutside
		: T extends FolderDeletedVaultEvent
			?
					| ScopedFolderDeletedVaultEventInside
					| ScopedFolderDeletedVaultEventOutside
			: T extends FileCreatedVaultEvent
				?
						| ScopedFileCreatedVaultEventInside
						| ScopedFileCreatedVaultEventOutside
				: T extends FileDeletedVaultEvent
					?
							| ScopedFileDeletedVaultEventInside
							| ScopedFileDeletedVaultEventOutside
					: T extends FileRenamedVaultEvent
						?
								| ScopedFileRenamedVaultEventInside
								| ScopedFileRenamedVaultEventOutside
								| ScopedFileRenamedVaultEventInsideToOutside
								| ScopedFileRenamedVaultEventOutsideToInside
						: T extends FolderRenamedVaultEvent
							?
									| ScopedFolderRenamedVaultEventInside
									| ScopedFolderRenamedVaultEventOutside
									| ScopedFolderRenamedVaultEventInsideToOutside
									| ScopedFolderRenamedVaultEventOutsideToInside
							: never;

type DescopedByType = {
	[VaultEventKind.FileCreated]: FileCreatedVaultEvent;
	[VaultEventKind.FileDeleted]: FileDeletedVaultEvent;
	[VaultEventKind.FolderCreated]: FolderCreatedVaultEvent;
	[VaultEventKind.FolderDeleted]: FolderDeletedVaultEvent;
	[VaultEventKind.FileRenamed]: FileRenamedVaultEvent;
	[VaultEventKind.FolderRenamed]: FolderRenamedVaultEvent;
};

export type DescopedEvent<T extends LibraryScopedVaultEvent> = T extends {
	type: infer K;
}
	? K extends keyof DescopedByType
		? DescopedByType[K]
		: never
	: never;
