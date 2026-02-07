import { z } from "zod/v3";
import { CREATE, DELETE, FILE, FOLDER, RENAME } from "./literals";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

const VaultEventKindSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${DELETE}d`,
	`${FOLDER}${CREATE}d`,
	`${FOLDER}${RENAME}d`,
	`${FOLDER}${DELETE}d`,
] as const);

export const VaultEventKind = VaultEventKindSchema.enum;
export type VaultEventKind = z.infer<typeof VaultEventKindSchema>;

export type VaultEvent =
	| FileCreatedVaultEvent
	| FileRenamedVaultEvent
	| FileDeletedVaultEvent
	| FolderCreatedVaultEvent
	| FolderRenamedVaultEvent
	| FolderDeletedVaultEvent;

export type FileCreatedVaultEvent = {
	kind: typeof VaultEventKind.FileCreated;
	splitPath: SplitPathToFile | SplitPathToMdFile;
};

export type FileRenamedVaultEvent = {
	kind: typeof VaultEventKind.FileRenamed;
	from: SplitPathToFile | SplitPathToMdFile;
	to: SplitPathToFile | SplitPathToMdFile;
};

export type FileDeletedVaultEvent = {
	kind: typeof VaultEventKind.FileDeleted;
	splitPath: SplitPathToFile | SplitPathToMdFile;
};

export type FolderCreatedVaultEvent = {
	kind: typeof VaultEventKind.FolderCreated;
	splitPath: SplitPathToFolder;
};

export type FolderRenamedVaultEvent = {
	kind: typeof VaultEventKind.FolderRenamed;
	from: SplitPathToFolder;
	to: SplitPathToFolder;
};

export type FolderDeletedVaultEvent = {
	kind: typeof VaultEventKind.FolderDeleted;
	splitPath: SplitPathToFolder;
};
