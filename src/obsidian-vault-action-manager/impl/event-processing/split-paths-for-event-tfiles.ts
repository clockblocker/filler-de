import type { TAbstractFile } from "obsidian";
import { makeSplitPath } from "../split-path-and-system-path";

export function splitPathsForFileCreated(tAbstractFile: TAbstractFile) {
	// Filter self-events (actions we dispatched)
	if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
		return null;
	}

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

export function splitPathsForFileRenamed(
	tAbstractFile: TAbstractFile,
	oldPath: string,
) {
	// Filter self-events (actions we dispatched)
	// Check new path (file.path) - old path already handled by tracking 'from' in self-event tracker
	if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
		return null;
	}

	const split = makeSplitPath(tAbstractFile);
	const from = makeSplitPath(oldPath);

	if (split.type === "Folder" && from.type === "Folder") {
		return {
			from: from,
			to: split,
			type: "FolderRenamed",
		};
	}
	if (split.type !== "Folder" && from.type !== "Folder") {
		return {
			from: from,
			to: split,
			type: "FileRenamed",
		};
	}
	// Mixed folder/file renames are invalid, skip
	return null;
}

export function splitPathsForFileTrashed(tAbstractFile: TAbstractFile) {
	if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
		return null;
	}

	const split = makeSplitPath(tAbstractFile);
	if (split.type === "Folder") {
		return {
			splitPath: split,
			type: "FolderTrashed",
		};
	}

	return {
		splitPath: split,
		type: "FileTrashed",
	};
}
