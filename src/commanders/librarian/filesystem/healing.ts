import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import type { RootNameLegacy } from "../constants";
import {
	canonicalizePrettyPathLegacy,
	isCanonical,
} from "../invariants/path-canonicalizer";
import { createFolderActionsForPathParts } from "../utils/folder-actions";

/**
 * Result of healing a file: actions to execute + metadata.
 */
export type HealResultLegacy = {
	actions: LegacyVaultAction[];
	/** The canonical path the file should be at (or quarantine destination) */
	targetPath: PrettyPathLegacy;
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
export function healFileLegacy(
	prettyPath: PrettyPathLegacy,
	rootName: RootNameLegacy,
	seen: Set<string> = new Set(),
): HealResultLegacy {
	const canonical = canonicalizePrettyPathLegacy({ prettyPath, rootName });

	// Quarantine case: undecodable basename
	if ("reason" in canonical) {
		const actions: LegacyVaultAction[] = [
			...createFolderActionsForPathParts(
				canonical.destination.pathParts,
				seen,
			),
			{
				payload: { from: prettyPath, to: canonical.destination },
				type: LegacyVaultActionType.RenameFile,
			},
		];
		return {
			actions,
			quarantined: true,
			targetPath: canonical.destination,
		};
	}

	// Already canonical — no actions needed
	if (isCanonical(prettyPath, canonical.canonicalPrettyPathLegacy)) {
		return {
			actions: [],
			quarantined: false,
			targetPath: canonical.canonicalPrettyPathLegacy,
		};
	}

	// Needs healing: create folder + rename
	const actions: LegacyVaultAction[] = [
		...createFolderActionsForPathParts(
			canonical.canonicalPrettyPathLegacy.pathParts,
			seen,
		),
		{
			payload: {
				from: prettyPath,
				to: canonical.canonicalPrettyPathLegacy,
			},
			type: LegacyVaultActionType.RenameFile,
		},
	];

	return {
		actions,
		quarantined: false,
		targetPath: canonical.canonicalPrettyPathLegacy,
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
export function healFilesLegacy(
	files: PrettyPathLegacy[],
	rootName: RootNameLegacy,
): LegacyVaultAction[] {
	const seen = new Set<string>();
	return files.flatMap((f) => healFileLegacy(f, rootName, seen).actions);
}
