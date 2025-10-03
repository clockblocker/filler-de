import { TexfresserObsidianServices } from '../../obsidian-services/interface';
import { TextsManagerService } from '../../obsidian-services/services/texts-manager-service';

export async function navigatePagesAction(
	services: Partial<TexfresserObsidianServices>,
	direction: 'prev' | 'next'
): Promise<void> {
	const { openedFileService } = services;

	if (!openedFileService) {
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

	// Create TextsManagerService instance
	const textsManagerService = new TextsManagerService(
		openedFileService.getApp()
	);

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
