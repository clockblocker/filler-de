import type { TAbstractFile, TFile, TFolder } from "obsidian";
import { z } from "zod";
import { splitPath as buildSplitPath, splitPathKey } from "./impl/split-path";
import { CREATE, FILE, RENAME, TRASH } from "./types/literals";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export const VaultEventTypeSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${TRASH}ed`,
] as const);

export const VaultEventType = VaultEventTypeSchema.enum;
export type VaultEventType = z.infer<typeof VaultEventTypeSchema>;

export type VaultEvent =
	| {
			type: typeof VaultEventType.FileCreated;
			splitPath: SplitPathToFile;
	  }
	| {
			type: typeof VaultEventType.FileRenamed;
			from: SplitPathToFile;
			to: SplitPathToFile;
	  }
	| {
			type: typeof VaultEventType.FileTrashed;
			splitPath: SplitPathToFile;
	  };

export type VaultEventHandler = (event: VaultEvent) => Promise<void>;

export type Teardown = () => void;

type MdFileReader = CoreSplitPath & {
	readContent: () => Promise<string>;
};

export interface ObsidianVaultActionManager {
	subscribe(handler: VaultEventHandler): Teardown;
	dispatch(actions: readonly VaultAction[]): Promise<void>;

	// Read-only operations
	readContent(splitPath: SplitPathToMdFile): Promise<string>;
	getReadersToAllMdFilesInFolder(
		folder: SplitPathToFolder,
	): Promise<MdFileReader[]>;

	exists(splitPath: SplitPath): Promise<boolean>;
	isInActiveView(splitPath: SplitPath): Promise<boolean>;

	list(splitPath: SplitPathToFolder): Promise<SplitPath[]>;
	pwd(): Promise<SplitPathToFile | SplitPathToMdFile>;
	openFile(target: SplitPathToFile | SplitPathToMdFile): Promise<void>;

	getAbstractFile<SP extends SplitPath>(
		splitPath: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile>;

	// Helpers
	splitPath(systemPath: string): SplitPath;
	splitPath(tFile: TFile): SplitPathToFile | SplitPathToMdFile;
	splitPath(tFolder: TFolder): SplitPathToFolder;
	splitPath(tAbstractFile: TAbstractFile): SplitPath;
}

export { splitPathKey };

export function splitPath(path: string): SplitPath;
export function splitPath(file: TFile): SplitPathToFile | SplitPathToMdFile;
export function splitPath(folder: TFolder): SplitPathToFolder;
export function splitPath(file: TAbstractFile): SplitPath;
export function splitPath(
	input: string | TAbstractFile,
): SplitPath | SplitPathToFile | SplitPathToMdFile | SplitPathToFolder {
	if (typeof input === "string") {
		return buildSplitPath(input);
	}
	return buildSplitPath(input);
}

export { ObsidianVaultActionManagerImpl } from "./impl/facade";
