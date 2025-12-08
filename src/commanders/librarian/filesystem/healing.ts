import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import type { RootName } from "../constants";
import {
	canonicalizePrettyPath,
	isCanonical,
} from "../invariants/path-canonicalizer";
import { createFolderActionsForPathParts } from "../utils/folder-actions";

/**
 * Result of healing a file: actions to execute + metadata.
 */
export type HealResult = {
	actions: VaultAction[];
	/** The canonical path the file should be at (or quarantine destination) */
	targetPath: PrettyPath;
	/** Whether the file was quarantined (undecodable basename) */
	quarantined: boolean;
};

/**
 * Heal a single file: determine canonical path and return actions to fix it.
 * Pure function — no filesystem access, no async.
 *
 * @param prettyPath - Current file location
 * @param rootName - Library root (e.g., "Worter")
 * @param seen - Set of folder paths already seen (for deduplication)
 * @returns Actions to execute (may be empty if already canonical)
 */
export function healFile(
	prettyPath: PrettyPath,
	rootName: RootName,
	seen: Set<string> = new Set(),
): HealResult {
	const canonical = canonicalizePrettyPath({ prettyPath, rootName });

	// Quarantine case: undecodable basename
	if ("reason" in canonical) {
		const actions: VaultAction[] = [
			...createFolderActionsForPathParts(
				canonical.destination.pathParts,
				seen,
			),
			{
				payload: { from: prettyPath, to: canonical.destination },
				type: VaultActionType.RenameFile,
			},
		];
		return {
			actions,
			quarantined: true,
			targetPath: canonical.destination,
		};
	}

	// Already canonical — no actions needed
	if (isCanonical(prettyPath, canonical.canonicalPrettyPath)) {
		return {
			actions: [],
			quarantined: false,
			targetPath: canonical.canonicalPrettyPath,
		};
	}

	// Needs healing: create folder + rename
	const actions: VaultAction[] = [
		...createFolderActionsForPathParts(
			canonical.canonicalPrettyPath.pathParts,
			seen,
		),
		{
			payload: { from: prettyPath, to: canonical.canonicalPrettyPath },
			type: VaultActionType.RenameFile,
		},
	];

	return {
		actions,
		quarantined: false,
		targetPath: canonical.canonicalPrettyPath,
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
	files: PrettyPath[],
	rootName: RootName,
): VaultAction[] {
	const seen = new Set<string>();
	return files.flatMap((f) => healFile(f, rootName, seen).actions);
}
