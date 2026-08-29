import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { type CommandError, CommandErrorKind } from "../errors";
import { splitStrInBlocks } from "../pages/segmenter/block-marker/split-str-in-blocks";
import type { LibrarianCommandFn } from "./types";
import { vamFailureToCommandError } from "./vam-failure";

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 * Dispatches ProcessMdFile action for replacement.
 */
export const splitInBlocksCommand: LibrarianCommandFn = Effect.fn(
	"Librarian.splitInBlocksCommand",
)(function* (input): Effect.fn.Return<void, CommandError> {
	const { commandContext, librarianState } = input;
	const { vam, notify } = librarianState;
	const { selection, activeFile } = commandContext;

	if (!selection?.text?.trim()) {
		yield* Effect.sync(() => notify("No text selected"));
		return yield* Effect.fail({ kind: CommandErrorKind.NoSelection });
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
	const actions = [action];

	yield* vam.dispatch(actions).pipe(
		Effect.mapError((error) => vamFailureToCommandError(error, actions)),
		Effect.tapError((error) =>
			Effect.sync(() => notify(`Error: ${error.reason}`)),
		),
	);
	yield* Effect.sync(() => notify(`Split into ${blockCount} blocks`));
});
