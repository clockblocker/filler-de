import type { TAbstractFile, TFile, TFolder } from "obsidian";
import { z } from "zod";
import type { DispatchResult } from "./impl/dispatcher";
import { splitPath as buildSplitPath, splitPathKey } from "./impl/split-path";
import { CREATE, FILE, RENAME, TRASH } from "./types/literals";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithTRef,
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
	  };

export type VaultEventHandlerLegacy = (event: VaultEvent) => Promise<void>;

export type Teardown = () => void;

export interface ObsidianVaultActionManager {
	subscribe(handler: VaultEventHandlerLegacy): Teardown;
	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;

	// Read-only operations
	readContent(splitPath: SplitPathToMdFile): Promise<string>;
	exists(splitPath: SplitPath): Promise<boolean>;
	isInActiveView(splitPath: SplitPath): Promise<boolean>;
	list(splitPath: SplitPathToFolder): Promise<SplitPath[]>;
	listAll(splitPath: SplitPathToFolder): Promise<SplitPathWithTRef[]>;
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

export { splitPathKey };
export type { DispatchError, DispatchResult } from "./impl/dispatcher";

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

export { ObsidianVaultActionManagerImpl } from "./facade";
