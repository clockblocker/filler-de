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
import type { CommandError, CommandPayload } from "../../types";
import { computeShardedFolderParts } from "../shard-path";

/**
 * Appends RenameMdFile action to move file to sharded path.
 * VAM auto-creates folders.
 */
export function moveToWorter(
	ctx: CommandPayload,
): Result<CommandPayload, CommandError> {
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
		actions: [...ctx.actions, action],
		splitPath: newPath,
	});
}
