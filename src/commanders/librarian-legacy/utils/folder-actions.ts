import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";

/**
 * Assumes pathParts[0] exists; creates mkdir actions starting at depth 1.
 */
export function createFolderActionsForPathParts(
	pathParts: string[],
	seen: Set<string>,
): LegacyVaultAction[] {
	const actions: LegacyVaultAction[] = [];

	for (let depth = 1; depth < pathParts.length; depth++) {
		const key = pathParts.slice(0, depth + 1).join("/");
		if (seen.has(key)) continue;
		seen.add(key);

		const basename = pathParts[depth] ?? "";
		const parentParts = pathParts.slice(0, depth);

		actions.push({
			payload: { prettyPath: { basename, pathParts: parentParts } },
			type: LegacyVaultActionType.UpdateOrCreateFolder,
		});
	}

	return actions;
}
