import { err, ok, type Result } from "neverthrow";
import type { TAbstractFile } from "obsidian";
import type { VaultEvent } from "../..";
import { makeSplitPath } from "../common/split-path-and-system-path";
import { EventProcessingErrorMessage } from "./errors";

export function makeVaultEventForFileCreated(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = makeSplitPath(tAbstractFile);
	if (split.kind === "Folder") {
		return {
			kind: "FolderCreated",
			splitPath: split,
		};
	}

	return {
		kind: "FileCreated",
		splitPath: split,
	};
}

export function tryMakeVaultEventForFileRenamed(
	tAbstractFile: TAbstractFile,
	oldPath: string,
): Result<VaultEvent, string> {
	const split = makeSplitPath(tAbstractFile);
	const from = makeSplitPath(oldPath);

	if (split.kind === "Folder" && from.kind === "Folder") {
		return ok({
			from: from,
			kind: "FolderRenamed",
			to: split,
		});
	}
	if (split.kind !== "Folder" && from.kind !== "Folder") {
		return ok({
			from: from,
			kind: "FileRenamed",
			to: split,
		});
	}

	return err(EventProcessingErrorMessage.MixedFolderFileRename);
}

export function makeVaultEventForFileDeleted(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = makeSplitPath(tAbstractFile);
	if (split.kind === "Folder") {
		return {
			kind: "FolderDeleted",
			splitPath: split,
		};
	}

	return {
		kind: "FileDeleted",
		splitPath: split,
	};
}
