import type { TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { TFile as TFileClass, TFolder as TFolderClass } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToFolder,
} from "../../../../types/split-path";
import type { DiscriminatedTAbstractFile } from "../../types";
import { systemPathFromSplitPathInternal } from "../system-and-any-split/system-path-and-split-path-codec";

/**
 * Core function to get TAbstractFile from SplitPath.
 * Returns null if file doesn't exist or type doesn't match.
 */
export function abstractFromSplitPathInternal<SP extends AnySplitPath>(
	vault: Vault,
	splitPath: SP,
): DiscriminatedTAbstractFile<SP> | null;
export function abstractFromSplitPathInternal(
	vault: Vault,
	splitPath: SplitPathToFolder,
): TFolder | null;
export function abstractFromSplitPathInternal(
	vault: Vault,
	splitPath: SplitPathToAnyFile,
): TFile | null;
export function abstractFromSplitPathInternal(
	vault: Vault,
	splitPath: AnySplitPath,
): TAbstractFile | null;

export function abstractFromSplitPathInternal(
	vault: Vault,
	splitPath: AnySplitPath,
): TAbstractFile | null {
	const systemPath = systemPathFromSplitPathInternal(splitPath);
	const file = vault.getAbstractFileByPath(systemPath);

	if (!file) return null;

	if (splitPath.kind === "Folder") {
		return file instanceof TFolderClass ? file : null;
	}

	return file instanceof TFileClass ? file : null;
}
