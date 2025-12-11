import type { CoreSplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import type { RootName } from "../constants";
import {
	canonicalizePath,
	isCanonical,
} from "../invariants/path-canonicalizer";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import { corePathToFolder, corePathToMdFile } from "../utils/path-conversions";

/**
 * Result of healing a file: actions to execute + metadata.
 */
export type HealResult = {
	actions: VaultAction[];
	/** The canonical path the file should be at (or quarantine destination) */
	targetPath: CoreSplitPath;
	/** Whether the file was quarantined (undecodable basename) */
	quarantined: boolean;
};

/**
 * Heal a single file: determine canonical path and return actions to fix it.
 * Pure function — no filesystem access, no async.
 *
 * @param path - Current file location
 * @param rootName - Library root (e.g., "Worter")
 * @param seen - Set of folder paths already seen (for deduplication)
 * @returns Actions to execute (may be empty if already canonical)
 */
export function healFile(
	path: CoreSplitPath,
	rootName: RootName,
	seen: Set<string> = new Set(),
): HealResult {
	const canonical = canonicalizePrettyPath({ path, rootName });

	// Quarantine case: undecodable basename
	if ("reason" in canonical) {
		const actions: VaultAction[] = [
			...createFolderActionsForPathParts(
				canonical.destination.pathParts,
				seen,
			),
			{
				payload: {
					from: corePathToMdFile(path),
					to: corePathToMdFile(canonical.destination),
				},
				type: VaultActionType.RenameMdFile,
			},
		];
		return {
			actions,
			quarantined: true,
			targetPath: canonical.destination,
		};
	}

	// Already canonical — no actions needed
	if (isCanonical(path, canonical.canonicalPath)) {
		return {
			actions: [],
			quarantined: false,
			targetPath: canonical.canonicalPath,
		};
	}

	// Needs healing: create folder + rename
	const actions: VaultAction[] = [
		...createFolderActionsForPathParts(
			canonical.canonicalPath.pathParts,
			seen,
		),
		{
			payload: {
				from: corePathToMdFile(path),
				to: corePathToMdFile(canonical.canonicalPath),
			},
			type: VaultActionType.RenameMdFile,
		},
	];

	return {
		actions,
		quarantined: false,
		targetPath: canonical.canonicalPath,
	};
}

/**
 * Heal multiple files, deduplicating folder creation actions.
 * Pure function — no filesystem access, no async.
 *
 * @param files - Files to heal
 * @param rootName - Library root
 * @returns Combined actions for all files
 */
export function healFiles(
	files: CoreSplitPath[],
	rootName: RootName,
): VaultAction[] {
	const seen = new Set<string>();
	return files.flatMap((f) => healFile(f, rootName, seen).actions);
}
