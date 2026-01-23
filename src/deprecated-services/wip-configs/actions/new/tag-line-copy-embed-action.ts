import { type App, MarkdownView, Notice } from "obsidian";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import {
	findHighestBlockNumber,
	formatBlockEmbed,
	getBlockIdFromLine,
} from "./block-utils";

type TagLineCopyEmbedServices = {
	app: App;
	vaultActionManager: VaultActionManager;
};

/**
 * Tags the current line with a block marker (if missing) and copies the block embed to clipboard.
 * Does nothing silently on empty/blank lines.
 */
export async function tagLineCopyEmbedAction(
	services: Partial<TagLineCopyEmbedServices>,
): Promise<void> {
	const { app, vaultActionManager } = services;

	if (!app || !vaultActionManager) {
		new Notice("Error: Missing required services");
		return;
	}

	try {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) {
			new Notice("No active markdown file");
			return;
		}

		const editor = view.editor;
		const basename = view.file.basename;
		const cursor = editor.getCursor();
		const lineNumber = cursor.line;
		const lineText = editor.getLine(lineNumber);

		// Skip empty/blank lines silently
		if (!lineText.trim()) {
			return;
		}

		let blockId = getBlockIdFromLine(lineText);

		if (!blockId) {
			// Need to add block marker - find highest existing number
			const contentResult = await vaultActionManager.getOpenedContent();
			if (contentResult.isErr()) {
				throw new Error(contentResult.error);
			}
			const fileContent = contentResult.value;

			const highestBlockNumber = findHighestBlockNumber(fileContent);
			const newBlockNumber = highestBlockNumber + 1;
			blockId = String(newBlockNumber);

			// Append block marker to end of line
			const newLineText = `${lineText} ^${blockId}`;
			editor.setLine(lineNumber, newLineText);
		}

		// Format and copy embed to clipboard
		const embed = formatBlockEmbed(basename, blockId);
		await navigator.clipboard.writeText(embed);

		new Notice("Block embed copied");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Error: ${message}`);
	}
}
