import type { VaultEvent } from "../../../obsidian-vault-action-manager";
import { systemPathFromSplitPath } from "../../../obsidian-vault-action-manager/helpers/pathfinder";

/**
 * Extract handler info from VaultEvent.
 * Pure function that converts events to handler parameters.
 */
export function parseEventToHandler(
	event: VaultEvent,
	libraryRoot: string,
): {
	type: "rename" | "create" | "delete";
	oldPath?: string;
	newPath?: string;
	path: string;
	isFolder: boolean;
} | null {
	if (event.type === "FileRenamed" || event.type === "FolderRenamed") {
		const oldPath = systemPathFromSplitPath(event.from);
		const newPath = systemPathFromSplitPath(event.to);
		// Only handle events within library
		if (
			!oldPath.startsWith(`${libraryRoot}/`) &&
			!newPath.startsWith(`${libraryRoot}/`)
		) {
			return null;
		}
		return {
			isFolder: event.type === "FolderRenamed",
			newPath,
			oldPath,
			path: newPath,
			type: "rename",
		};
	}

	if (event.type === "FileCreated" || event.type === "FolderCreated") {
		const path = systemPathFromSplitPath(event.splitPath);
		// Only handle events within library
		if (!path.startsWith(`${libraryRoot}/`)) {
			return null;
		}
		return {
			isFolder: event.type === "FolderCreated",
			path,
			type: "create",
		};
	}

	if (event.type === "FileTrashed" || event.type === "FolderTrashed") {
		const path = systemPathFromSplitPath(event.splitPath);
		// Only handle events within library
		if (!path.startsWith(`${libraryRoot}/`)) {
			return null;
		}
		return {
			isFolder: event.type === "FolderTrashed",
			path,
			type: "delete",
		};
	}

	return null;
}

/**
 * Check if path should be ignored (outside library or codex file).
 */
export function shouldIgnorePath(
	path: string,
	basenameWithoutExt: string,
	libraryRoot: string,
	isCodexBasename: (basename: string) => boolean,
): boolean {
	if (!path.startsWith(`${libraryRoot}/`)) {
		return true;
	}
	return isCodexBasename(basenameWithoutExt);
}
