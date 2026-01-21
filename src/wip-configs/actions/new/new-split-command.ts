import { Notice } from "obsidian";
import type { OpenedFileService } from "../../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../services/dto-services/quote-manager/interface";
import type { SelectionService } from "../../../services/obsidian-services/atomic-services/selection-service";

export default async function wrapSentencesInQuoteAnchor({
	selectionService,
	openedFileService,
}: {
	selectionService: SelectionService;
	openedFileService: OpenedFileService;
}) {
	try {
		const selection = await selectionService.getSelection();
		const contentResult = await openedFileService.getContent();
		if (contentResult.isErr()) {
			throw new Error(contentResult.error);
		}
		const fileContent = contentResult.value;

		const highestBlockNumber = findHighestBlockNumber(fileContent);

		const tFileResult = await openedFileService.getOpenedTFile();
		if (tFileResult.isErr()) {
			throw new Error(tFileResult.error);
		}
		const nameOfTheOpenendFile = tFileResult.value.name;

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
