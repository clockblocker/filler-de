import { errAsync, okAsync, ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../managers/obsidian/vault-action-manager";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { splitStrInBlocks } from "../bookkeeper/segmenter/block-marker/split-str-in-blocks";
import { type CommandError, CommandErrorKind } from "../errors";
import type { LibrarianCommandFn } from "./types";

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 * Dispatches ProcessMdFile action for replacement.
 */
export const splitInBlocksCommand: LibrarianCommandFn = (input) => {
	const { commandContext, librarianState } = input;
	const { vam, notify } = librarianState;
	const { selection, activeFile } = commandContext;

	if (!selection?.text?.trim()) {
		notify("No text selected");
		return errAsync({ kind: CommandErrorKind.NoSelection });
	}

	const highestBlockNumber = blockIdHelper.findHighestNumber(
		activeFile.content,
	);
	const startIndex = highestBlockNumber + 1;

	const { markedText, blockCount } = splitStrInBlocks(
		selection.text,
		startIndex,
	);

	const action: VaultAction = {
		kind: VaultActionKind.ProcessMdFile,
		payload: {
			after: markedText,
			before: selection.text,
			splitPath: selection.splitPathToFileWithSelection,
		},
	};

	return ResultAsync.fromPromise(vam.dispatch([action]), () => ({
		kind: CommandErrorKind.DispatchFailed,
		reason: "unknown",
	})).andThen((result) => {
		if (result.isErr()) {
			const reason = result.error.map((e) => e.error).join(", ");
			notify(`Error: ${reason}`);
			return errAsync<void, CommandError>({
				kind: CommandErrorKind.DispatchFailed,
				reason,
			});
		}
		notify(`Split into ${blockCount} blocks`);
		return okAsync(undefined);
	});
};
