import { Notice } from 'obsidian';
import { OpenedFileService } from 'obsidian-services/opened-file-service';
import { SelectionService } from 'obsidian-services/selection-service';
import { toLinkedSegmentedSentences } from 'simple-text-processors/split-in-sentences';
import { unwrapMaybe } from 'types/general';

export default async function splitSelectionInSentences({
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
			await openedFileService.getMaybeOpenedFile()
		).name;

		// await navigator.clipboard.writeText(`${formattedText}`);

		const asdasd = toLinkedSegmentedSentences({
			selection,
			nameOfTheOpenendFile,
			highestBlockNumber,
		});

		console.log(asdasd);

		await selectionService.replaceSelection(asdasd);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}

function findHighestBlockNumber(content: string): number {
	const matches = content.match(/#\^(\d+)/g);
	if (!matches) return 0;

	const numbers = matches.map((match) => {
		const num = match.replace('#^', '');
		return parseInt(num, 10);
	});

	return Math.max(0, ...numbers);
}
