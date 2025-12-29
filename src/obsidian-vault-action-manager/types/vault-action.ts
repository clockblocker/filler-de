// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import {
	CREATE,
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	RENAME,
	TRASH,
	UPSERT,
} from "./literals";
import type {
	SplitPathFromTo,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

// Operations allowed per target
const FolderOps = z.enum([CREATE, RENAME, TRASH] as const);
const FileOps = z.enum([CREATE, RENAME, TRASH] as const);
const MdFileOps = z.enum([UPSERT, PROCESS, RENAME, TRASH] as const);

const TargetSchema = z.enum([FOLDER, FILE, MD_FILE] as const);
const Target = TargetSchema.enum;

export const VaultActionTypeSchema = z.enum([
	...FolderOps.options.map((op) => `${op}${Target.Folder}` as const),
	...FileOps.options.map((op) => `${op}${Target.File}` as const),
	...MdFileOps.options.map((op) => `${op}${Target.MdFile}` as const),
] as const);

export const VaultActionType = VaultActionTypeSchema.enum;
export type VaultActionType = z.infer<typeof VaultActionTypeSchema>;

export type Transform = (content: string) => string | Promise<string>;

// Folder payloads
type CreateFolderPayload = {
	splitPath: SplitPathToFolder;
	content?: string;
};
type RenameFolderPayload = SplitPathFromTo<SplitPathToFolder>;
type TrashFolderPayload = { splitPath: SplitPathToFolder };

// File payloads
type CreateFilePayload = {
	splitPath: SplitPathToFile;
	content?: string;
};
type RenameFilePayload = SplitPathFromTo<SplitPathToFile>;
type TrashFilePayload = { splitPath: SplitPathToFile };

// MdFile payloads
type UpsertMdFilePayload = {
	splitPath: SplitPathToMdFile;
	/**
	 * Content to write. If null or undefined, ensures file exists without overwriting existing content.
	 * If empty string, creates with empty content.
	 */
	content?: string | null;
};
type RenameMdFilePayload = SplitPathFromTo<SplitPathToMdFile>;
type TrashMdFilePayload = { splitPath: SplitPathToMdFile };
type ProcessMdFilePayload = {
	splitPath: SplitPathToMdFile;
	transform: Transform;
};

export type VaultAction =
	| {
			type: typeof VaultActionType.CreateFolder;
			payload: CreateFolderPayload;
	  }
	| {
			type: typeof VaultActionType.RenameFolder;
			payload: RenameFolderPayload;
	  }
	| { type: typeof VaultActionType.TrashFolder; payload: TrashFolderPayload }
	| { type: typeof VaultActionType.CreateFile; payload: CreateFilePayload }
	| { type: typeof VaultActionType.RenameFile; payload: RenameFilePayload }
	| { type: typeof VaultActionType.TrashFile; payload: TrashFilePayload }
	| {
			type: typeof VaultActionType.UpsertMdFile;
			payload: UpsertMdFilePayload;
	  }
	| {
			type: typeof VaultActionType.RenameMdFile;
			payload: RenameMdFilePayload;
	  }
	| { type: typeof VaultActionType.TrashMdFile; payload: TrashMdFilePayload }
	| {
			type: typeof VaultActionType.ProcessMdFile;
			payload: ProcessMdFilePayload;
	  };
