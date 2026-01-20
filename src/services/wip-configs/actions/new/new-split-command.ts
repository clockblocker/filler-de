import { Notice } from "obsidian";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../dto-services/quote-manager/interface";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export default async function wrapSentencesInQuoteAnchor(
	services: Partial<TexfresserObsidianServices>,
) {
	const { selectionService, vaultActionManager } = services;

	if (!selectionService || !vaultActionManager) {
		new Notice("Error: Missing required services");
		return;
	}

	try {
		const selection = await selectionService.getSelection();
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

		await selectionService.replaceSelection(
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
