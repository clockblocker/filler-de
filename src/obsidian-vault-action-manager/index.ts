import type { TAbstractFile, TFile, TFolder } from "obsidian";
import { z } from "zod";
import { CREATE, FILE, RENAME, TRASH } from "./types/literals";
import type {
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

export interface ObsidianVaultActionManager {
	subscribe(handler: VaultEventHandler): Teardown;
	dispatch(actions: readonly VaultAction[]): Promise<void>;

	// Read-only operations
	readContent(splitPath: SplitPathToMdFile): Promise<string>;
	exists(splitPath: SplitPath): Promise<boolean>;
	isInActiveView(splitPath: SplitPath): Promise<boolean>;
	list(splitPath: SplitPathToFolder): Promise<SplitPath[]>;
	pwd(): Promise<SplitPathToFile | SplitPathToMdFile>;

	getAbstractFile<SP extends SplitPath>(
		splitPath: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile>;

	// Helpers
	splitPath(systemPath: string): SplitPath;
	splitPath(tFile: TFile): SplitPathToFile | SplitPathToMdFile;
	splitPath(tFolder: TFolder): SplitPathToFolder;
	splitPath(tAbstractFile: TAbstractFile): SplitPath;
}
