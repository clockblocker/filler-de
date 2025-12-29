import z from "zod";
import { CREATE, FILE, FOLDER, RENAME, TRASH } from "./literals";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

const VaultEventTypeSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${TRASH}ed`,
	`${FOLDER}${CREATE}d`,
	`${FOLDER}${RENAME}d`,
	`${FOLDER}${TRASH}ed`,
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
			type: typeof VaultEventType.FileTrashed;
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
			type: typeof VaultEventType.FolderTrashed;
			splitPath: SplitPathToFolder;
	  };
