import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import { unwrapMaybeByThrowing } from "../../../../types/common-interface/maybe";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export async function navigatePageAction(
	services: Partial<TexfresserObsidianServices>,
	direction: "prev" | "next",
): Promise<void> {
	const { openedFileService } = services;

	if (!openedFileService) {
		console.error("Missing required services for navigatePageAction");
		return;
	}

	const maybeFile = await openedFileService.getMaybeOpenedTFile();
	const currentFile = unwrapMaybeByThrowing(maybeFile);

	// const textsManagerService = new VaultCurrator(openedFileService.getApp());

	try {
		const targetPage: any = null;

		if (direction === "prev") {
			// targetPage = await textsManagerService.getPreviousPage(currentFile);
		} else {
			// targetPage = await textsManagerService.getNextPage(currentFile);
		}

		if (targetPage) {
			await openedFileService.cd(targetPage);
		} else {
			logWarning({
				description: `No ${direction} page found`,
				location: "navigatePageAction",
			});
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
