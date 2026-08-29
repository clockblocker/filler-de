import type { TAbstractFile } from "obsidian";
import type { VaultEvent } from "../..";
import { splitPathFromAbstractInternal } from "../../helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import { splitPathCodec } from "../../split-path-codec";
import { EventProcessingErrorMessage } from "./errors";

export function makeVaultEventForFileCreated(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = splitPathFromAbstractInternal(tAbstractFile);
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
):
	| { readonly event: VaultEvent; readonly success: true }
	| { readonly error: string; readonly success: false } {
	const split = splitPathFromAbstractInternal(tAbstractFile);
	const from = splitPathCodec.parse(oldPath);

	if (split.kind === "Folder" && from.kind === "Folder") {
		return {
			event: {
				from: from,
				kind: "FolderRenamed",
				to: split,
			},
			success: true,
		};
	}
	if (split.kind !== "Folder" && from.kind !== "Folder") {
		return {
			event: {
				from: from,
				kind: "FileRenamed",
				to: split,
			},
			success: true,
		};
	}

	return {
		error: EventProcessingErrorMessage.MixedFolderFileRename,
		success: false,
	};
}

export function makeVaultEventForFileDeleted(
	tAbstractFile: TAbstractFile,
): VaultEvent {
	const split = splitPathFromAbstractInternal(tAbstractFile);
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
