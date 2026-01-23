import { Notice } from "obsidian";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../dto-services/quote-manager/interface";

export default async function wrapSentencesInQuoteAnchor(services: {
	vaultActionManager: VaultActionManager;
}) {
	const { vaultActionManager } = services;
	const openedFileService = vaultActionManager.openedFileService;

	try {
		const selection = openedFileService.getSelection();
		if (!selection) {
			new Notice("No text selected");
			return;
		}

		const contentResult = await vaultActionManager.getOpenedContent();
		if (contentResult.isErr()) {
			throw new Error(contentResult.error);
		}
		const fileContent = contentResult.value;

		const highestBlockNumber = findHighestBlockNumber(fileContent);

		const fileNameResult = await vaultActionManager.getOpenedFileName();
		if (fileNameResult.isErr()) {
			throw new Error(fileNameResult.error);
		}
		const nameOfTheOpenendFile = fileNameResult.value;

		openedFileService.replaceSelection(
			formatQuotedLines(
				segmentInQuotedLines({
					highestBlockNumber,
					nameOfTheOpenendFile,
					text: selection,
				}),
			),
		);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}

function findHighestBlockNumber(content: string): number {
	const matches = content.match(/#\^(\d+)/g);
	if (!matches) return 0;

	const numbers = matches.map((match) => {
		const num = match.replace("#^", "");
		return Number.parseInt(num, 10);
	});

	return Math.max(0, ...numbers);
}
