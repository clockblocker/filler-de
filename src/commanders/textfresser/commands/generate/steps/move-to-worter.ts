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
import type {
	CommandError,
	CommandState,
	TextfresserCommandKind,
} from "../../types";

type Generate = typeof TextfresserCommandKind.Generate;

/** Appends RenameMdFile action to move file to sharded path. */
export function moveToWorter(
	ctx: CommandState<Generate>,
): Result<CommandState<Generate>, CommandError> {
	const splitPath = ctx.currentFileInfo.path;
	const shardedParts = computeShardedFolderParts(splitPath.basename);

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
		currentFileInfo: { ...ctx.currentFileInfo, path: newPath },
	});
}
