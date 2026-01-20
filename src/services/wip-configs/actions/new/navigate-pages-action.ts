import {
	logError,
	logWarning,
} from "../../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export async function navigatePageAction(
	services: Partial<TexfresserObsidianServices>,
	direction: "prev" | "next",
): Promise<void> {
	const { vaultActionManager } = services;

	if (!vaultActionManager) {
		console.error("Missing required services for navigatePageAction");
		return;
	}

	const fileNameResult = await vaultActionManager.getOpenedFileName();
	if (fileNameResult.isErr()) {
		logError({
			description: `Error getting current file: ${fileNameResult.error}`,
			location: "navigatePageAction",
		});
		return;
	}

	// const textsManagerService = new VaultCurrator(...);

	try {
		const targetPage: SplitPathToMdFile | null = null;

		if (direction === "prev") {
			// targetPage = await textsManagerService.getPreviousPage(currentFile);
		} else {
			// targetPage = await textsManagerService.getNextPage(currentFile);
		}

		if (targetPage) {
			await vaultActionManager.cd(targetPage);
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
