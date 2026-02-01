import { splitStrInBlocks } from "../../../commanders/librarian/bookkeeper/segmenter/block-marker/split-str-in-blocks";
import { blockIdHelper } from "../../../stateless-helpers/block-id";

export type SplitInBlocksPayload = {
	selection: string;
	fileContent: string;
};

export type SplitInBlocksDeps = {
	replaceSelection: (text: string) => void;
	notify: (message: string) => void;
};

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 */
export function splitSelectionBlocksCommand(
	payload: SplitInBlocksPayload,
	deps: SplitInBlocksDeps,
): void {
	const { selection, fileContent } = payload;
	const { replaceSelection, notify } = deps;

	if (!selection?.trim()) {
		notify("No text selected");
		return;
	}

	const highestBlockNumber = blockIdHelper.findHighestNumber(fileContent);
	const startIndex = highestBlockNumber + 1;

	const { markedText, blockCount } = splitStrInBlocks(selection, startIndex);

	replaceSelection(markedText);
	notify(`Split into ${blockCount} blocks`);
}
