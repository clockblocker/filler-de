import { TexfresserObsidianServices } from '../../obsidian-services/interface';

export async function navigatePagesAction(
	services: Partial<TexfresserObsidianServices>,
	direction: 'prev' | 'next'
): Promise<void> {
	const { openedFileService, textsManagerService } = services;

	if (!openedFileService || !textsManagerService) {
		console.error('Missing required services for navigatePagesAction');
		return;
	}

	// Get the currently opened file
	const maybeFile = await openedFileService.getMaybeOpenedFile();
	if (maybeFile.error) {
		console.error('No active markdown file');
		return;
	}

	const currentFile = maybeFile.data;

	try {
		let targetPage: any = null;

		if (direction === 'prev') {
			targetPage = await textsManagerService.getPreviousPage(currentFile);
		} else {
			targetPage = await textsManagerService.getNextPage(currentFile);
		}

		if (targetPage) {
			await openedFileService.openFile(targetPage);
		} else {
			console.log(`No ${direction} page found`);
		}
	} catch (error) {
		console.error(`Error navigating to ${direction} page:`, error);
	}
}
