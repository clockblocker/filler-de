import { type App, MarkdownView, Notice } from "obsidian";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { getErrorMessage } from "../../../utils/get-error-message";
import type { VaultActionManager } from "../vault-action-manager";
import { logError } from "../vault-action-manager/helpers/issue-handlers";

type TagLineCopyEmbedServices = {
	app: App;
	vam: VaultActionManager;
};

/**
 * Tags the current line with a block marker (if missing) and copies the block embed to clipboard.
 * Does nothing silently on empty/blank lines.
 */
export async function tagLineCopyEmbedBehavior(
	services: Partial<TagLineCopyEmbedServices>,
): Promise<void> {
	const { app, vam } = services;

	if (!app || !vam) {
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

		let blockId = blockIdHelper.extractNumeric(lineText);

		if (!blockId) {
			// Need to add block marker - find highest existing number
			const contentResult = await vam.getOpenedContent();
			if (contentResult.isErr()) {
				throw new Error(contentResult.error);
			}
			const fileContent = contentResult.value;

			const highestBlockNumber =
				blockIdHelper.findHighestNumber(fileContent);
			const newBlockNumber = highestBlockNumber + 1;
			blockId = String(newBlockNumber);

			// Append block marker to end of line
			const newLineText = `${lineText} ^${blockId}`;
			editor.setLine(lineNumber, newLineText);
		}

		// Format and copy embed to clipboard
		const embed = blockIdHelper.formatEmbed(basename, blockId);
		await navigator.clipboard.writeText(embed);
	} catch (error) {
		logError({
			description: `Error tagging line with block embed: ${getErrorMessage(error)}`,
			location: "tagLineCopyEmbedBehavior",
		});
	}
}
