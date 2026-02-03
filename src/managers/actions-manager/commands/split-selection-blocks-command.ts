import { splitStrInBlocks } from "../../../commanders/librarian/bookkeeper/segmenter/block-marker/split-str-in-blocks";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import {
	type VaultAction,
	VaultActionKind,
	type VaultActionManager,
} from "../../obsidian/vault-action-manager";
import type { CommandContext } from "../types";

export type SplitInBlocksDeps = {
	vam: VaultActionManager;
	notify: (message: string) => void;
};

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 * Dispatches ProcessMdFile action for replacement.
 */
export async function splitSelectionBlocksCommand(
	context: CommandContext,
	deps: SplitInBlocksDeps,
): Promise<void> {
	const { vam, notify } = deps;
	const { selection } = context;

	if (!selection?.text?.trim()) {
		notify("No text selected");
		return;
	}

	// Get file content for finding highest block ID
	const contentResult = vam.getOpenedContent();
	if (contentResult.isErr()) {
		notify(`Error: ${contentResult.error}`);
		return;
	}

	const fileContent = contentResult.value;
	const highestBlockNumber = blockIdHelper.findHighestNumber(fileContent);
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

	const result = await vam.dispatch([action]);

	if (result.isErr()) {
		notify(`Error: ${result.error.map((e) => e.error).join(", ")}`);
		return;
	}

	notify(`Split into ${blockCount} blocks`);
}
