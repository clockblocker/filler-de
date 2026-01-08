import z from "zod";
import { CREATE, DELETE, FILE, FOLDER, RENAME } from "./literals";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

const VaultEventTypeSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${DELETE}d`,
	`${FOLDER}${CREATE}d`,
	`${FOLDER}${RENAME}d`,
	`${FOLDER}${DELETE}d`,
] as const);

export const VaultEventType = VaultEventTypeSchema.enum;
export type VaultEventType = z.infer<typeof VaultEventTypeSchema>;

export type VaultEvent =
	| FileCreatedVaultEvent
	| FileRenamedVaultEvent
	| FileDeletedVaultEvent
	| FolderCreatedVaultEvent
	| FolderRenamedVaultEvent
	| FolderDeletedVaultEvent;

export type FileCreatedVaultEvent = {
	type: typeof VaultEventType.FileCreated;
	splitPath: SplitPathToFile | SplitPathToMdFile;
};

export type FileRenamedVaultEvent = {
	type: typeof VaultEventType.FileRenamed;
	from: SplitPathToFile | SplitPathToMdFile;
	to: SplitPathToFile | SplitPathToMdFile;
};

export type FileDeletedVaultEvent = {
	type: typeof VaultEventType.FileDeleted;
	splitPath: SplitPathToFile | SplitPathToMdFile;
};

export type FolderCreatedVaultEvent = {
	type: typeof VaultEventType.FolderCreated;
	splitPath: SplitPathToFolder;
};

export type FolderRenamedVaultEvent = {
	type: typeof VaultEventType.FolderRenamed;
	from: SplitPathToFolder;
	to: SplitPathToFolder;
};

export type FolderDeletedVaultEvent = {
	type: typeof VaultEventType.FolderDeleted;
	splitPath: SplitPathToFolder;
};
