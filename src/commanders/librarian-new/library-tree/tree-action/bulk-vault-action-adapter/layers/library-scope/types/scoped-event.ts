import z from "zod";
import type {
	BulkVaultEvent,
	VaultEventType,
} from "../../../../../../../../obsidian-vault-action-manager";
import type {
	FileRenamedVaultEvent,
	FolderRenamedVaultEvent,
} from "../../../../../../../../obsidian-vault-action-manager/types/vault-event";
import type { Prettify } from "../../../../../../../../types/helpers";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./inside-library-split-paths";

export const ScopeSchema = z.enum([
	"InsideToOutside",
	"Inside",
	"OutsideToInside",
	"OutsideToOutside",
]);

export const Scope = ScopeSchema.enum;
export type Scope = z.infer<typeof ScopeSchema>;

// -- inside --

export type ScopedFileCreatedVaultEventInside = {
	type: typeof VaultEventType.FileCreated;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFileDeletedVaultEventInside = {
	type: typeof VaultEventType.FileDeleted;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFolderCreatedVaultEventInside = {
	type: typeof VaultEventType.FolderCreated;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFolderDeletedVaultEventInside = {
	type: typeof VaultEventType.FolderDeleted;
	scope: typeof Scope.Inside;

	splitPath: SplitPathToFolderInsideLibrary;
};

export type ScopedFileRenamedVaultEventInside = {
	type: typeof VaultEventType.FileRenamed;
	scope: typeof Scope.Inside;

	from: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
	to: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary;
};

export type ScopedFolderRenamedVaultEventInside = {
	type: typeof VaultEventType.FolderRenamed;
	scope: typeof Scope.Inside;

	from: SplitPathToFolderInsideLibrary;
	to: SplitPathToFolderInsideLibrary;
};

// -- inside to outside --

export type ScopedFileRenamedVaultEventInsideToOutside = {
	type: typeof VaultEventType.FileRenamed;
	scope: typeof Scope.InsideToOutside;

	from: ScopedFileRenamedVaultEventInside["from"];
	to: FileRenamedVaultEvent["to"];
};

export type ScopedFolderRenamedVaultEventInsideToOutside = {
	type: typeof VaultEventType.FolderRenamed;
	scope: typeof Scope.InsideToOutside;

	from: ScopedFolderRenamedVaultEventInside["from"];
	to: FolderRenamedVaultEvent["to"];
};

// -- outside to inside --

export type ScopedFileRenamedVaultEventOutsideToInside = {
	type: typeof VaultEventType.FileRenamed;
	scope: typeof Scope.OutsideToInside;

	from: FileRenamedVaultEvent["to"];
	to: ScopedFileRenamedVaultEventInside["to"];
};

export type ScopedFolderRenamedVaultEventOutsideToInside = {
	type: typeof VaultEventType.FolderRenamed;
	scope: typeof Scope.OutsideToInside;

	from: FolderRenamedVaultEvent["to"];
	to: ScopedFolderRenamedVaultEventInside["to"];
};

// -- outside to outside --

export type ScopedFileRenamedVaultEventOutsideToOutside = Prettify<
	FileRenamedVaultEvent & {
		scope: typeof Scope.OutsideToOutside;
	}
>;

export type ScopedFolderRenamedVaultEventOutsideToOutside = Prettify<
	FolderRenamedVaultEvent & {
		scope: typeof Scope.OutsideToOutside;
	}
>;

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
	| ScopedFileRenamedVaultEventOutsideToOutside
	| ScopedFolderRenamedVaultEventOutsideToOutside;

export type HealingLibraryScopedVaultEvent = Extract<
	LibraryScopedVaultEvent,
	{ scope: typeof Scope.Inside }
>;

export type LibraryScopedBulkVaultEvent = Omit<
	BulkVaultEvent,
	"events" | "roots"
> & {
	events: LibraryScopedVaultEvent[];
	roots: LibraryScopedVaultEvent[];
};
