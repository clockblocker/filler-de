import { Notice } from "obsidian";
import { unwrapMaybe } from "../../../../types/common-interface/maybe";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../dto-services/quote-manager/interface";
import type { OpenedFileService } from "../../../obsidian-services/atomic-services/opened-file-service";
import type { SelectionService } from "../../../obsidian-services/atomic-services/selection-service";

export default async function wrapSentencesInQuoteAnchor({
	selectionService,
	openedFileService,
}: {
	selectionService: SelectionService;
	openedFileService: OpenedFileService;
}) {
	try {
		const selection = await selectionService.getSelection();
		const fileContent = await openedFileService.getFileContent();

		const highestBlockNumber = findHighestBlockNumber(fileContent);

		const nameOfTheOpenendFile = unwrapMaybe(
			await openedFileService.getMaybeOpenedFile(),
		).name;

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
