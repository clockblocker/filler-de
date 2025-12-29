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
	| {
			type: typeof VaultEventType.FileCreated;
			splitPath: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FileRenamed;
			from: SplitPathToFile | SplitPathToMdFile;
			to: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FileDeleted;
			splitPath: SplitPathToFile | SplitPathToMdFile;
	  }
	| {
			type: typeof VaultEventType.FolderCreated;
			splitPath: SplitPathToFolder;
	  }
	| {
			type: typeof VaultEventType.FolderRenamed;
			from: SplitPathToFolder;
			to: SplitPathToFolder;
	  }
	| {
			type: typeof VaultEventType.FolderDeleted;
			splitPath: SplitPathToFolder;
	  };
