import type { VaultEvent } from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	VaultEventKind,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/vault-event";
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
} from "../scoped-event";

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
	kind: infer K;
}
	? K extends keyof DescopedByType
		? DescopedByType[K]
		: never
	: never;
