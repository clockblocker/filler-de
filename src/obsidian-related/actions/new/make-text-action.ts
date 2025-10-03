import { TexfresserObsidianServices } from '../../obsidian-services/interface';

export async function makeTextAction(
	services: Partial<TexfresserObsidianServices>
): Promise<void> {
	const { openedFileService, textsManagerService } = services;

	if (!openedFileService || !textsManagerService) {
		console.error('Missing required services for makeTextAction');
		return;
	}

	// Get the currently opened file
	const maybeFile = await openedFileService.getMaybeOpenedFile();
	if (maybeFile.error) {
		console.error('No active markdown file');
		return;
	}

	const currentFile = maybeFile.data;

	// Check if metaInfo is empty
	const hasEmptyMeta = await textsManagerService.hasEmptyMetaInfo(currentFile);
	if (!hasEmptyMeta) {
		console.log('File already has metaInfo, skipping text creation');
		return;
	}

	try {
		// Get file content using the service
		const maybeContent = await openedFileService.getMaybeFileContent();
		if (maybeContent.error) {
			console.error('Could not read file content');
			return;
		}

		const content = maybeContent.data;
		const textStructure = await textsManagerService.createTextFromCurrentFile(
			currentFile,
			content
		);

		console.log('Text structure created:', textStructure);

		// Open the text root file using the service
		await openedFileService.openFile(textStructure.textRootFile);
	} catch (error) {
		console.error('Error creating text structure:', error);
	}
}
