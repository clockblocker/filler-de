import { splitPath } from "../../../obsidian-vault-action-manager";
import type { SplitPathToFolder } from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";

/**
 * Assumes pathParts[0] exists; creates mkdir actions starting at depth 1.
 */
export function createFolderActionsForPathParts(
	pathParts: string[],
	seen: Set<string>,
): VaultAction[] {
	const actions: VaultAction[] = [];

	for (let depth = 1; depth < pathParts.length; depth++) {
		const key = pathParts.slice(0, depth + 1).join("/");
		if (seen.has(key)) continue;
		seen.add(key);

		const basename = pathParts[depth] ?? "";
		const parentParts = pathParts.slice(0, depth);
		const folderPath = [...parentParts, basename].join("/");
		const folderSplitPath = splitPath(folderPath) as SplitPathToFolder;

		actions.push({
			payload: { coreSplitPath: folderSplitPath },
			type: VaultActionType.CreateFolder,
		});
	}

	return actions;
}
