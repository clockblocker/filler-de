import { Notice } from "obsidian";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../services/dto-services/quote-manager/interface";
import type { SelectionService } from "../../../services/obsidian-services/atomic-services/selection-service";
import type { OpenedFileService } from "../../../services/obsidian-services/file-services/active-view/opened-file-service";
import { unwrapMaybeByThrowing } from "../../../types/common-interface/maybe";

export default async function wrapSentencesInQuoteAnchor({
	selectionService,
	openedFileService,
}: {
	selectionService: SelectionService;
	openedFileService: OpenedFileService;
}) {
	try {
		const selection = await selectionService.getSelection();
		const fileContent = await openedFileService.getContent();

		const highestBlockNumber = findHighestBlockNumber(fileContent);

		const nameOfTheOpenendFile = unwrapMaybeByThrowing(
			await openedFileService.getMaybeOpenedTFile(),
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
