import { Notice } from "obsidian";
import { splitStrInBlocks } from "../../../../commanders/librarian/bookkeeper/segmenter/block-marker";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

/**
 * Splits selected text into blocks with Obsidian block markers (^N).
 * Finds highest existing block ID in file and continues numbering from there.
 */
export async function splitSelectionInBlocksAction(
	services: Partial<TexfresserObsidianServices>,
): Promise<void> {
	const { selectionService, vaultActionManager } = services;

	if (!selectionService || !vaultActionManager) {
		new Notice("Error: Missing required services");
		return;
	}

	try {
		const selection = await selectionService.getSelection();

		if (!selection.trim()) {
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
		const { markedText, blockCount } = splitStrInBlocks(selection, startIndex);

		// Replace selection with marked text
		await selectionService.replaceSelection(markedText);

		new Notice(`Split into ${blockCount} blocks`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error: ${message}`);
	}
}

/**
 * Find the highest block ID number in file content.
 * Matches patterns like " ^0", " ^123", etc.
 */
function findHighestBlockNumber(content: string): number {
	// Match block markers at end of lines: " ^N" or "^N" at line end
	const matches = content.match(/\s\^(\d+)(?:\s*$|\n)/gm);
	if (!matches) return -1;

	const numbers = matches.map((match) => {
		const numMatch = match.match(/\^(\d+)/);
		return numMatch ? Number.parseInt(numMatch[1], 10) : 0;
	});

	return Math.max(-1, ...numbers);
}
