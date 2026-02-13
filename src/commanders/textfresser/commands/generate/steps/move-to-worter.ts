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
import type { CommandError, CommandStateWithLemma } from "../../types";

/** Appends RenameMdFile action to move file to sharded path. */
export function moveToWorter(
	ctx: CommandStateWithLemma,
): Result<CommandStateWithLemma, CommandError> {
	const activeFile = ctx.commandContext.activeFile;
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const shardedParts = computeShardedFolderParts(
		activeFile.splitPath.basename,
		ctx.textfresserState.languages.target,
		lemmaResult.linguisticUnit,
		lemmaResult.surfaceKind,
	);

	// Skip rename if already at the correct destination (e.g. background generate pre-computed path)
	const currentParts = activeFile.splitPath.pathParts;
	const alreadyAtDestination =
		currentParts.length === shardedParts.length &&
		currentParts.every((p, i) => p === shardedParts[i]);

	if (alreadyAtDestination) {
		return ok(ctx);
	}

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
