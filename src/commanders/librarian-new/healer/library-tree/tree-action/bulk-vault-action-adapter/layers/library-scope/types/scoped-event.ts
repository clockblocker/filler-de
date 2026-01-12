import z from "zod";
import type {
	BulkVaultEvent,
	VaultEventKind,
} from "../../../../../../../../../managers/obsidian/vault-action-manager";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
} from "../../../../../../../../../managers/obsidian/vault-action-manager/types/vault-event";
import type { Prettify } from "../../../../../../../../../types/helpers";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../../../codecs/split-path-inside-library/types";

export const ScopeSchema = z.enum([
	"Inside",
	"Outside",
	"InsideToOutside",
	"OutsideToInside",
]);

export const Scope = ScopeSchema.enum;
export type Scope = z.infer<typeof ScopeSchema>;

export type LibraryScopedVaultEvent =
	| ScopedFileCreatedVaultEventInside
	| ScopedFileDeletedVaultEventInside
	| ScopedFolderCreatedVaultEventInside
	| ScopedFolderDeletedVaultEventInside
	| ScopedFileRenamedVaultEventInside
	| ScopedFolderRenamedVaultEventInside
	| ScopedFileRenamedVaultEventInsideToOutside
	| ScopedFolderRenamedVaultEventInsideToOutside
	| ScopedFileRenamedVaultEventOutsideToInside
	| ScopedFolderRenamedVaultEventOutsideToInside
	| ScopedFileRenamedVaultEventOutside
	| ScopedFolderRenamedVaultEventOutside
	| ScopedFileDeletedVaultEventOutside
	| ScopedFolderDeletedVaultEventOutside
	| ScopedFileCreatedVaultEventOutside
	| ScopedFolderCreatedVaultEventOutside;

export type LibraryScopedBulkVaultEvent = Omit<
	BulkVaultEvent,
	"events" | "roots"
> & {
	events: LibraryScopedVaultEvent[];
	roots: LibraryScopedVaultEvent[];
};

// -- inside --

export type ScopedFileCreatedVaultEventInside = {
	kind: typeof VaultEventKind.FileCreated;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFileDeletedVaultEventInside = {
	kind: typeof VaultEventKind.FileDeleted;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFolderCreatedVaultEventInside = {
	kind: typeof VaultEventKind.FolderCreated;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFolderDeletedVaultEventInside = {
	kind: typeof VaultEventKind.FolderDeleted;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFileRenamedVaultEventInside = {
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.Inside;

	from: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
	to: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

// -- inside to inside --

export type ScopedFolderRenamedVaultEventInside = {
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.Inside;

	from: SplitPathToFolderInsideLibrary;
	to: SplitPathToFolderInsideLibrary;
};

// -- inside to outside --

export type ScopedFileRenamedVaultEventInsideToOutside = {
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.InsideToOutside;

	from: ScopedFileRenamedVaultEventInside["from"];
	to: FileRenamedVaultEvent["to"];
};

export type ScopedFolderRenamedVaultEventInsideToOutside = {
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.InsideToOutside;

	from: ScopedFolderRenamedVaultEventInside["from"];
	to: FolderRenamedVaultEvent["to"];
};

// -- outside to inside --

export type ScopedFileRenamedVaultEventOutsideToInside = {
	kind: typeof VaultEventKind.FileRenamed;
	scope: typeof Scope.OutsideToInside;

	from: FileRenamedVaultEvent["to"];
	to: ScopedFileRenamedVaultEventInside["to"];
};

export type ScopedFolderRenamedVaultEventOutsideToInside = {
	kind: typeof VaultEventKind.FolderRenamed;
	scope: typeof Scope.OutsideToInside;

	from: FolderRenamedVaultEvent["to"];
	to: ScopedFolderRenamedVaultEventInside["to"];
};

// -- outside to outside --

export type ScopedFileRenamedVaultEventOutside = Prettify<
	FileRenamedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;

export type ScopedFolderRenamedVaultEventOutside = Prettify<
	FolderRenamedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;

// -- outside --

export type ScopedFileDeletedVaultEventOutside = Prettify<
	FileDeletedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;

export type ScopedFolderDeletedVaultEventOutside = Prettify<
	FolderDeletedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;

export type ScopedFileCreatedVaultEventOutside = Prettify<
	FileCreatedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;

export type ScopedFolderCreatedVaultEventOutside = Prettify<
	FolderCreatedVaultEvent & {
		scope: typeof Scope.Outside;
	}
>;
