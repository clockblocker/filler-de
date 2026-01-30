/**
 * Move file to sharded Worter/Ordered folder structure.
 */

import { ok, type Result } from "neverthrow";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { computeShardedFolderParts } from "../shard-path";
import type { GenerateContext, GenerateError } from "../types";

/**
 * Appends CreateFolder + RenameMdFile actions to move file to sharded path.
 */
export function moveToWorter(
	ctx: GenerateContext,
): Result<GenerateContext, GenerateError> {
	const { splitPath } = ctx;
	const shardedParts = computeShardedFolderParts(splitPath.basename);

	const actions: VaultAction[] = [];

	// Create folder hierarchy
	for (let i = 1; i <= shardedParts.length; i++) {
		const folderParts = shardedParts.slice(0, i);
		const folderPath: SplitPathToFolder = {
			basename: folderParts[folderParts.length - 1],
			kind: SplitPathKind.Folder,
			pathParts: folderParts.slice(0, -1),
		};
		actions.push({
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folderPath },
		});
	}

	// Rename (move) file to new location
	const newPath: SplitPathToMdFile = {
		basename: splitPath.basename,
		extension: splitPath.extension,
		kind: SplitPathKind.MdFile,
		pathParts: shardedParts,
	};

	actions.push({
		kind: VaultActionKind.RenameMdFile,
		payload: { from: splitPath, to: newPath },
	});

	return ok({
		...ctx,
		actions: [...ctx.actions, ...actions],
	});
}
