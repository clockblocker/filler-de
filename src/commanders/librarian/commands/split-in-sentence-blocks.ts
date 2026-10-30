import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { type CommandError, CommandErrorKind } from "../errors";
import { splitStrInSentenceBlocks } from "../pages/segmenter/block-marker/split-str-in-sentence-blocks";
import type { LibrarianCommandFn } from "./types";

/**
 * Splits selected text into sentence blocks, one Sentence each, with
 * Obsidian block markers (^N). Finds highest existing block ID in file and
 * continues numbering from there. Dispatches ProcessMdFile action for
 * replacement.
 */
export const splitInSentenceBlocksCommand: LibrarianCommandFn = Effect.fn(
	"Librarian.splitInSentenceBlocksCommand",
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

	const { markedText, blockCount } = splitStrInSentenceBlocks(
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
	yield* vam.dispatch([action], { caller: "librarian" }).pipe(
		Effect.mapError((error) => ({
			kind: CommandErrorKind.DispatchFailed,
			reason: error.message,
		})),
		Effect.tapError((error) =>
			Effect.sync(() => notify(`Error: ${error.reason}`)),
		),
	);
	yield* Effect.sync(() =>
		notify(
			`Split into ${blockCount} sentence block${blockCount === 1 ? "" : "s"}`,
		),
	);
});
