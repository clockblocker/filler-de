import { Notice } from 'obsidian';
import { OpenedFileService } from 'obsidian-services/opened-file-service';
import { SelectionService } from 'obsidian-services/selection-service';
import { sentences } from 'sbd';
import { unwrapMaybe } from 'types/general';
import { wrapTextInBacklinkBlock } from 'utils';

export default async function newSplitSelectionInBlocks({
	selectionService,
	openedFileService,
}: {
	selectionService: SelectionService;
	openedFileService: OpenedFileService;
}) {
	try {
		const selection = await selectionService.getSelection();

		const fileContent = await openedFileService.getFileContent();

		const splittedByNewLine = selection.split('\n');

		let formattedText = '';

		const nameOfTheOpenendFile = unwrapMaybe(
			await openedFileService.getMaybeOpenedFile()
		).name;

		const formattedLines = [];
		for (const line of splittedByNewLine) {
			// If the line starts with "#" or contains no letters, push as is and continue
			if (line.trim().startsWith('#') || !/\p{L}/u.test(line)) {
				formattedLines.push(line);
				continue;
			}

			const sentencesInLine = sentences(line, {
				preserve_whitespace: false,
				newline_boundaries: false,
				html_boundaries: false,
				sanitize: true,
			});

			// Build blocks from sentencesInLine, merging short sentences with previous block
			const blockContentsInLine = [];
			for (const sentence of sentencesInLine) {
				const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
				if (wordCount <= 4 && blockContentsInLine.length > 0) {
					blockContentsInLine[blockContentsInLine.length - 1] +=
						' ' + sentence.trim();
				} else {
					blockContentsInLine.push(sentence.trim());
				}
			}
			blockContentsInLine.forEach((block) => {
				formattedLines.push(
					wrapTextInBacklinkBlock(
						block,
						nameOfTheOpenendFile,
						findHighestBlockNumber(fileContent) + 1
					)
				);
			});
		}

		formattedText = formattedLines.join('\n');

		// await navigator.clipboard.writeText(`${formattedText}`);
		await selectionService.replaceSelection(`${formattedText}`);
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
