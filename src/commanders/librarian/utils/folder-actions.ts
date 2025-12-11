import { splitPath } from "../../../obsidian-vault-action-manager";
import type { SplitPathToFolder } from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";

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
		const prettyPath = splitPath(folderPath) as SplitPathToFolder;

		actions.push({
			payload: { prettyPath },
			type: VaultActionType.UpdateOrCreateFolder,
		});
	}

	return actions;
}
