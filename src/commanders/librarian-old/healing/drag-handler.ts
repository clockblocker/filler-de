import { getParsedUserSettings } from "../../../global-state/global-state";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { DragInSubtype } from "../types/literals";
import { parseBasenameDeprecated } from "../utils/parse-basename";
import {
	computePathPartsFromSuffixDepreacated,
	folderNameNeedsSanitizationDepreacated,
	sanitizeFolderNameDepreacated,
} from "../utils/path-suffix-utils";

/**
 * Result of drag-in handling.
 */
export type DragInResult = {
	/** Actions to execute (renames, folder creates) */
	actions: VaultAction[];
	/** Whether folder sanitization was needed */
	sanitized: boolean;
};

/**
 * Handle file drag-in from outside library.
 * Mode 3 (File): Suffix wins → move to suffix location.
 * Reads libraryRoot from global settings.
 *
 * @param newPath - The path where file was dropped (inside library)
 * @returns Actions to move file to correct location
 */
export function handleFileDragIn(
	newPath: SplitPathToFile | SplitPathToMdFile,
): DragInResult {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	const parsed = parseBasenameDeprecated(newPath.basename);

	// Compute target path from suffix
	const targetPathParts = computePathPartsFromSuffixDepreacated(
		parsed.splitSuffix,
	);
	const fullTargetPathParts = [libraryRoot, ...targetPathParts];

	// Check if already in correct location
	const currentRelativePath = getRelativePathParts(
		newPath.pathParts,
		libraryRoot,
	);
	if (pathPartsEqual(targetPathParts, currentRelativePath)) {
		return { actions: [], sanitized: false };
	}

	// Need to move file to suffix location
	const actions: VaultAction[] = [];

	// Create target folders if needed
	for (let i = 1; i <= fullTargetPathParts.length; i++) {
		const folderPathParts = fullTargetPathParts.slice(0, i - 1);
		const folderBasename = fullTargetPathParts[i - 1];
		if (folderBasename && i > 1) {
			// Skip creating library root itself
			actions.push({
				payload: {
					splitPath: {
						basename: folderBasename,
						pathParts: folderPathParts,
						type: "Folder",
					},
				},
				type: VaultActionType.CreateFolder,
			});
		}
	}

	// Move file
	const targetPath: SplitPathToFile | SplitPathToMdFile = {
		...newPath,
		pathParts: fullTargetPathParts,
	};

	if (newPath.type === "MdFile") {
		actions.push({
			payload: {
				from: newPath as SplitPathToMdFile,
				to: targetPath as SplitPathToMdFile,
			},
			type: VaultActionType.RenameMdFile,
		});
	} else {
		actions.push({
			payload: {
				from: newPath as SplitPathToFile,
				to: targetPath as SplitPathToFile,
			},
			type: VaultActionType.RenameFile,
		});
	}

	return { actions, sanitized: false };
}

/**
 * Handle folder drag-in from outside library.
 * Mode 3 (Folder): Path wins → sanitize folder name + heal contents Mode-2 style.
 *
 * This only handles folder sanitization. Content healing is done separately
 * after tree is built from the new folder structure.
 *
 * @param newPath - The folder path where it was dropped (inside library)
 * @param libraryRoot - Library root folder name
 * @returns Actions to sanitize folder name (if needed)
 */
export function handleFolderDragIn(
	newPath: SplitPathToFolder,
	_libraryRoot: string,
): DragInResult {
	// libraryRoot kept for potential future use (nested folder checks)
	if (!folderNameNeedsSanitizationDepreacated(newPath.basename)) {
		return { actions: [], sanitized: false };
	}

	const sanitizedBasename = sanitizeFolderNameDepreacated(newPath.basename);

	const targetPath: SplitPathToFolder = {
		...newPath,
		basename: sanitizedBasename,
	};

	const actions: VaultAction[] = [
		{
			payload: {
				from: newPath,
				to: targetPath,
			},
			type: VaultActionType.RenameFolder,
		},
	];

	return { actions, sanitized: true };
}

/**
 * Handle drag-in based on subtype.
 * Reads libraryRoot from global settings.
 */
export function handleDragIn(
	subtype: DragInSubtype,
	newPath: SplitPathToFile | SplitPathToMdFile | SplitPathToFolder,
): DragInResult {
	if (subtype === DragInSubtype.File) {
		return handleFileDragIn(newPath as SplitPathToFile | SplitPathToMdFile);
	}

	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	return handleFolderDragIn(newPath as SplitPathToFolder, libraryRoot);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRelativePathParts(
	pathParts: string[],
	libraryRoot: string,
): string[] {
	if (pathParts[0] === libraryRoot) {
		return pathParts.slice(1);
	}
	return pathParts;
}

function pathPartsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((part, i) => part === b[i]);
}
