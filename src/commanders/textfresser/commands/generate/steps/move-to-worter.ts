import { ok, type Result } from "neverthrow";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { computeShardedFolderParts } from "../../../common/sharded-path";
import type { CommandError, CommandState } from "../../types";

/** Appends RenameMdFile action to move file to sharded path. */
export function moveToWorter(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	const activeFile = ctx.commandContext.activeFile;
	const shardedParts = computeShardedFolderParts(
		activeFile.splitPath.basename,
	);

	const newPath: SplitPathToMdFile = {
		basename: activeFile.splitPath.basename,
		extension: activeFile.splitPath.extension,
		kind: SplitPathKind.MdFile,
		pathParts: shardedParts,
	};

	const action: VaultAction = {
		kind: VaultActionKind.RenameMdFile,
		payload: { from: activeFile.splitPath, to: newPath },
	};

	return ok({
		...ctx,
		actions: [...ctx.actions, action],
		commandContext: {
			...ctx.commandContext,
			activeFile: { ...activeFile, splitPath: newPath },
		},
	});
}
