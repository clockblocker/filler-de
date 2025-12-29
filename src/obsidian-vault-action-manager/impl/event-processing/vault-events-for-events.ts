import { err, ok, type Result } from "neverthrow";
import type { TAbstractFile } from "obsidian";
import type { VaultEvent } from "../..";
import { makeSplitPath } from "../split-path-and-system-path";
import { EventProcessingErrorMessage } from "./errors";

export function makeVaultEventForFileCreated(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = makeSplitPath(tAbstractFile);
	if (split.type === "Folder") {
		return {
			splitPath: split,
			type: "FolderCreated",
		};
	}

	return {
		splitPath: split,
		type: "FileCreated",
	};
}

export function tryMakeVaultEventForFileRenamed(
	tAbstractFile: TAbstractFile,
	oldPath: string,
): Result<VaultEvent, string> {
	const split = makeSplitPath(tAbstractFile);
	const from = makeSplitPath(oldPath);

	if (split.type === "Folder" && from.type === "Folder") {
		return ok({
			from: from,
			to: split,
			type: "FolderRenamed",
		});
	}
	if (split.type !== "Folder" && from.type !== "Folder") {
		return ok({
			from: from,
			to: split,
			type: "FileRenamed",
		});
	}

	return err(EventProcessingErrorMessage.MixedFolderFileRename);
}

export function makeVaultEventForFileDeleted(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = makeSplitPath(tAbstractFile);
	if (split.type === "Folder") {
		return {
			splitPath: split,
			type: "FolderDeleted",
		};
	}

	return {
		splitPath: split,
		type: "FileDeleted",
	};
}
