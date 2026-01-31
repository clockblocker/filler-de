/**
 * Move file to sharded Worter/Ordered folder structure.
 */

import { ok, type Result } from "neverthrow";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { computeShardedFolderParts } from "../shard-path";
import type { GenerateContext, GenerateError } from "../types";

/**
 * Appends RenameMdFile action to move file to sharded path.
 * VAM auto-creates folders.
 */
export function moveToWorter(
	ctx: GenerateContext,
): Result<GenerateContext, GenerateError> {
	const { splitPath } = ctx;
	const shardedParts = computeShardedFolderParts(splitPath.basename);

	// Rename (move) file to new location - VAM auto-creates folders
	const newPath: SplitPathToMdFile = {
		basename: splitPath.basename,
		extension: splitPath.extension,
		kind: SplitPathKind.MdFile,
		pathParts: shardedParts,
	};

	const action: VaultAction = {
		kind: VaultActionKind.RenameMdFile,
		payload: { from: splitPath, to: newPath },
	};

	return ok({
		...ctx,
		splitPath: newPath,
		actions: [...ctx.actions, action],
	});
}
