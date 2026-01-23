import { Notice } from "obsidian";
import { splitStrInBlocks } from "../../../../commanders/librarian/bookkeeper/segmenter/block-marker";
import type { VaultActionManager } from "../../../obsidian/vault-action-manager";
import { findHighestBlockNumber } from "./block-utils";

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 */
export async function splitSelectionInBlocksAction(services: {
	vaultActionManager: VaultActionManager;
}): Promise<void> {
	const { vaultActionManager } = services;

	try {
		const openedFileService = vaultActionManager.openedFileService;
		const selection = openedFileService.getSelection();

		if (!selection?.trim()) {
			new Notice("No text selected");
			return;
		}

		// Get file content to find highest existing block number
		const contentResult = await vaultActionManager.getOpenedContent();
		if (contentResult.isErr()) {
			throw new Error(contentResult.error);
		}
		const fileContent = contentResult.value;

		const highestBlockNumber = findHighestBlockNumber(fileContent);
		const startIndex = highestBlockNumber + 1;

		// Split selection into blocks
		const { markedText, blockCount } = splitStrInBlocks(
			selection,
			startIndex,
		);

		// Replace selection with marked text
		openedFileService.replaceSelection(markedText);

		new Notice(`Split into ${blockCount} blocks`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error: ${message}`);
	}
}
