import { Notice } from "obsidian";
import { unwrapMaybeLegacyByThrowing } from "../../../../types/common-interface/maybe";
import {
	formatQuotedLines,
	segmentInQuotedLines,
} from "../../../dto-services/quote-manager/interface";
import type { SelectionService } from "../../../obsidian-services/atomic-services/selection-service";
import type { LegacyOpenedFileService } from "../../../obsidian-services/file-services/active-view/legacy-opened-file-service";

export default async function wrapSentencesInQuoteAnchor({
	selectionService,
	openedFileService,
}: {
	selectionService: SelectionService;
	openedFileService: LegacyOpenedFileService;
}) {
	try {
		const selection = await selectionService.getSelection();
		const fileContent = await openedFileService.getContent();

		const highestBlockNumber = findHighestBlockNumber(fileContent);

		const nameOfTheOpenendFile = unwrapMaybeLegacyByThrowing(
			await openedFileService.getMaybeLegacyOpenedTFile(),
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
