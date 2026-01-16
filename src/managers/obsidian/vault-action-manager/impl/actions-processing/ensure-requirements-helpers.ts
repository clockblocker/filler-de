import { pathToFolderFromPathParts } from "../../helpers/pathfinder";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import { makeSystemPathForSplitPath } from "../common/split-path-and-system-path";
import type { ExistenceChecker } from "./dispatcher";

/**
 * Collect trash paths from actions.
 * Returns sets of folder and file keys that will be trashed.
 */
export function collectTrashPaths(actions: readonly VaultAction[]): {
	folderKeys: Set<string>;
	fileKeys: Set<string>;
} {
	const folderKeys = new Set<string>();
	const fileKeys = new Set<string>();

	for (const action of actions) {
		if (action.kind === VaultActionKind.TrashFolder) {
			folderKeys.add(
				makeSystemPathForSplitPath(action.payload.splitPath),
			);
		} else if (
			action.kind === VaultActionKind.TrashFile ||
			action.kind === VaultActionKind.TrashMdFile
		) {
			fileKeys.add(makeSystemPathForSplitPath(action.payload.splitPath));
		}
	}

	return { fileKeys, folderKeys };
}

/**
 * Collect required folder and file keys from actions.
 * Extracts parent folders and target files that need to exist.
 */
export function collectRequirements(actions: readonly VaultAction[]): {
	folderKeys: Set<string>;
	fileKeys: Set<string>;
} {
	const folderKeys = new Set<string>();
	const fileKeys = new Set<string>();

	for (const action of actions) {
		switch (action.kind) {
			// Actions with splitPath: extract parent folders
			case VaultActionKind.CreateFolder:
			case VaultActionKind.CreateFile:
			case VaultActionKind.UpsertMdFile:
			case VaultActionKind.ProcessMdFile: {
				const { splitPath } = action.payload;
				// Extract all parent folders from pathParts
				for (let i = 1; i <= splitPath.pathParts.length; i++) {
					const parentPathParts = splitPath.pathParts.slice(0, i);
					const parentPath =
						pathToFolderFromPathParts(parentPathParts);
					if (parentPath) {
						folderKeys.add(parentPath);
					}
				}
				// For ProcessMdFile, ensure the file exists
				if (action.kind === VaultActionKind.ProcessMdFile) {
					const fileKey = makeSystemPathForSplitPath(
						splitPath as SplitPathToMdFile,
					);
					fileKeys.add(fileKey);
				}
				break;
			}

			// Rename actions: extract parent folders from "to" path
			case VaultActionKind.RenameFolder:
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile: {
				const { to } = action.payload;
				// Extract all parent folders from "to" pathParts
				for (let i = 1; i <= to.pathParts.length; i++) {
					const parentPathParts = to.pathParts.slice(0, i);
					const parentPath =
						pathToFolderFromPathParts(parentPathParts);
					if (parentPath) {
						folderKeys.add(parentPath);
					}
				}
				break;
			}
		}
	}

	return { fileKeys, folderKeys };
}

/**
 * Build all parent folder keys from a splitPath.
 * Returns keys for all parent folders in the path hierarchy.
 */
export function buildParentFolderKeys(splitPath: SplitPathToFolder): string[] {
	const keys: string[] = [];

	for (let i = 1; i <= splitPath.pathParts.length; i++) {
		const parentPathParts = splitPath.pathParts.slice(0, i - 1);
		const parentBasename = splitPath.pathParts[i - 1];
		if (!parentBasename) continue;

		const parentSplitPath: SplitPathToFolder = {
			basename: parentBasename,
			kind: "Folder",
			pathParts: parentPathParts,
		};
		keys.push(makeSystemPathForSplitPath(parentSplitPath));
	}

	return keys;
}

/**
 * Build EnsureExist keys recursively for folders and files.
 * Filters out keys that conflict with trash paths (Trash wins).
 */
export function buildEnsureExistKeys(
	folderKeys: Set<string>,
	fileKeys: Set<string>,
	trashFolderKeys: Set<string>,
	trashFileKeys: Set<string>,
	pathToSplitPathToFolder: (path: string) => SplitPathToFolder | null,
	keyToSplitPathToMdFile: (key: string) => SplitPathToMdFile | null,
): {
	folderKeys: Set<string>;
	fileKeys: Set<string>;
} {
	const ensureExistFolderKeys = new Set<string>();
	const ensureExistFileKeys = new Set<string>();

	// For each required folder, recursively add parent folders
	for (const folderPath of folderKeys) {
		const folderSplitPath = pathToSplitPathToFolder(folderPath);
		if (!folderSplitPath) continue;

		const folderKey = makeSystemPathForSplitPath(folderSplitPath);
		// Skip if Trash exists for this path
		if (trashFolderKeys.has(folderKey)) {
			continue; // Trash wins, skip EnsureExist
		}

		// Recursively add parent folders
		const parentKeys = buildParentFolderKeys(folderSplitPath);
		for (const parentKey of parentKeys) {
			if (!trashFolderKeys.has(parentKey)) {
				ensureExistFolderKeys.add(parentKey);
			}
		}

		// Add target folder itself
		ensureExistFolderKeys.add(folderKey);
	}

	// For each required file, recursively add parent folders
	for (const fileKey of fileKeys) {
		const fileSplitPath = keyToSplitPathToMdFile(fileKey);
		if (!fileSplitPath) continue;

		// Skip if Trash exists for this path
		if (trashFileKeys.has(fileKey)) {
			continue; // Trash wins, skip EnsureExist
		}

		// Recursively add parent folders (same logic as for folders)
		for (let i = 1; i <= fileSplitPath.pathParts.length; i++) {
			const parentPathParts = fileSplitPath.pathParts.slice(0, i - 1);
			const parentBasename = fileSplitPath.pathParts[i - 1];
			if (!parentBasename) continue;

			const parentSplitPath: SplitPathToFolder = {
				basename: parentBasename,
				kind: "Folder",
				pathParts: parentPathParts,
			};
			const parentKey = makeSystemPathForSplitPath(parentSplitPath);
			if (!trashFolderKeys.has(parentKey)) {
				ensureExistFolderKeys.add(parentKey);
			}
		}

		// Add target file itself
		ensureExistFileKeys.add(fileKey);
	}

	return {
		fileKeys: ensureExistFileKeys,
		folderKeys: ensureExistFolderKeys,
	};
}

/**
 * Check if an action already exists in the batch for a given key.
 * For folders, also checks if a RenameFolder action creates the folder at the destination.
 */
export function hasActionForKey(
	actions: readonly VaultAction[],
	key: string,
	kind: "folder" | "file",
): boolean {
	if (kind === "folder") {
		return actions.some(
			(a) =>
				// CreateFolder directly creates the folder
				(a.kind === VaultActionKind.CreateFolder &&
					makeSystemPathForSplitPath(a.payload.splitPath) === key) ||
				// RenameFolder creates the folder at the destination
				(a.kind === VaultActionKind.RenameFolder &&
					makeSystemPathForSplitPath(a.payload.to) === key),
		);
	}

	// For files, check UpsertMdFile and ProcessMdFile
	return actions.some(
		(a) =>
			(a.kind === VaultActionKind.UpsertMdFile &&
				makeSystemPathForSplitPath(a.payload.splitPath) === key) ||
			(a.kind === VaultActionKind.ProcessMdFile &&
				makeSystemPathForSplitPath(a.payload.splitPath) === key),
	);
}

/**
 * Destinations that need to be checked for existence.
 */
export type DestinationsToCheck = {
	ensureExistFolderKeys: Set<string>;
	ensureExistFileKeys: Set<string>;
	createFolderKeys: Set<string>;
	createFileKeys: Set<string>;
};

/**
 * Get all destinations that need to be checked from actions.
 * Pure function that analyzes actions and returns what needs checking.
 */
export function getDestinationsToCheck(
	actions: readonly VaultAction[],
	pathToSplitPathToFolder: (path: string) => SplitPathToFolder | null,
	keyToSplitPathToMdFile: (key: string) => SplitPathToMdFile | null,
): DestinationsToCheck {
	// Collect trash paths (Trash wins over EnsureExist)
	const { folderKeys: trashFolderKeys, fileKeys: trashFileKeys } =
		collectTrashPaths(actions);

	// Collect requirements from non-trash actions
	const nonTrashActions = actions.filter(
		(a) =>
			a.kind !== VaultActionKind.TrashFolder &&
			a.kind !== VaultActionKind.TrashFile &&
			a.kind !== VaultActionKind.TrashMdFile,
	);
	const { folderKeys, fileKeys } = collectRequirements(nonTrashActions);

	// Build EnsureExist keys recursively
	const { folderKeys: ensureExistFolderKeys, fileKeys: ensureExistFileKeys } =
		buildEnsureExistKeys(
			folderKeys,
			fileKeys,
			trashFolderKeys,
			trashFileKeys,
			pathToSplitPathToFolder,
			keyToSplitPathToMdFile,
		);

	return {
		createFileKeys: fileKeys,
		createFolderKeys: folderKeys,
		ensureExistFileKeys,
		ensureExistFolderKeys,
	};
}

/**
 * Ensure destinations exist by checking existence and returning actions to add.
 * Pure function that handles caching internally.
 */
export async function ensureDestinationsExist(
	destinations: DestinationsToCheck,
	existenceChecker: ExistenceChecker,
	pathToSplitPathToFolder: (path: string) => SplitPathToFolder | null,
	keyToSplitPathToMdFile: (key: string) => SplitPathToMdFile | null,
	existingActions: readonly VaultAction[],
): Promise<VaultAction[]> {
	const actionsToAdd: VaultAction[] = [];

	// Performance: Cache existence checks to avoid redundant file ops
	const checkedFolders = new Set<string>();
	const checkedFiles = new Set<string>();
	const existingFolders = new Set<string>();
	const existingFiles = new Set<string>();

	// Add EnsureExist actions
	for (const folderKey of destinations.ensureExistFolderKeys) {
		const folderSplitPath = pathToSplitPathToFolder(folderKey);
		if (!folderSplitPath) continue;

		// Check cache first (O(1))
		if (checkedFolders.has(folderKey)) {
			if (existingFolders.has(folderKey)) {
				continue; // Already exists, skip EnsureExist
			}
		} else {
			// Check existence (file op)
			checkedFolders.add(folderKey);
			const exists = await existenceChecker.exists(folderSplitPath);
			if (exists) {
				existingFolders.add(folderKey);
				continue; // Already exists, skip EnsureExist
			}
		}

		// Check if already in batch
		if (!hasActionForKey(existingActions, folderKey, "folder")) {
			actionsToAdd.push({
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folderSplitPath },
			});
		}
	}

	for (const fileKey of destinations.ensureExistFileKeys) {
		const fileSplitPath = keyToSplitPathToMdFile(fileKey);
		if (!fileSplitPath) continue;

		// Check cache first (O(1))
		if (checkedFiles.has(fileKey)) {
			if (existingFiles.has(fileKey)) {
				continue; // Already exists, skip EnsureExist
			}
		} else {
			// Check existence (file op)
			checkedFiles.add(fileKey);
			const exists = await existenceChecker.exists(fileSplitPath);
			if (exists) {
				existingFiles.add(fileKey);
				continue; // Already exists, skip EnsureExist
			}
		}

		// Check if already in batch
		if (!hasActionForKey(existingActions, fileKey, "file")) {
			actionsToAdd.push({
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: fileSplitPath },
			});
		}
	}

	// Add CreateFolder actions for required folders (only if they don't exist)
	for (const folderPath of destinations.createFolderKeys) {
		const folderSplitPath = pathToSplitPathToFolder(folderPath);
		if (!folderSplitPath) continue;

		const folderKey = makeSystemPathForSplitPath(folderSplitPath);
		// Check cache first (O(1))
		if (checkedFolders.has(folderKey)) {
			if (existingFolders.has(folderKey)) {
				continue; // Already exists
			}
		} else {
			// Check existence (file op)
			checkedFolders.add(folderKey);
			const exists = await existenceChecker.exists(folderSplitPath);
			if (exists) {
				existingFolders.add(folderKey);
				continue; // Already exists
			}
		}

		// Check if already in batch
		if (!hasActionForKey(existingActions, folderKey, "folder")) {
			actionsToAdd.push({
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folderSplitPath },
			});
		}
	}

	// Add UpsertMdFile actions for required files (only if they don't exist)
	for (const fileKey of destinations.createFileKeys) {
		const fileSplitPath = keyToSplitPathToMdFile(fileKey);
		if (!fileSplitPath) continue;

		// Check cache first (O(1))
		if (checkedFiles.has(fileKey)) {
			if (existingFiles.has(fileKey)) {
				continue; // File exists, no need to create
			}
		} else {
			// Check existence (file op)
			checkedFiles.add(fileKey);
			const exists = await existenceChecker.exists(fileSplitPath);
			if (exists) {
				existingFiles.add(fileKey);
				continue; // File exists, no need to create
			}
		}

		// Check if UpsertMdFile already exists in the batch
		if (!hasActionForKey(existingActions, fileKey, "file")) {
			// Use content: null (EnsureExist) so collapse keeps both ProcessMdFile + UpsertMdFile(null)
			// Dependency graph ensures UpsertMdFile executes first, then ProcessMdFile processes it
			actionsToAdd.push({
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: null, splitPath: fileSplitPath },
			});
		}
	}

	return actionsToAdd;
}
