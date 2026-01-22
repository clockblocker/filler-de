import {
	getNextPageSplitPath,
	getPrevPageSplitPath,
} from "../../../../commanders/librarian/bookkeeper/page-codec";
import { logError } from "../../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import { logger } from "../../../../utils/logger";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export async function navigatePageAction(
	services: Partial<TexfresserObsidianServices>,
	direction: "prev" | "next",
): Promise<void> {
	const { vaultActionManager } = services;

	if (!vaultActionManager) {
		return;
	}

	const pwdResult = await vaultActionManager.pwd();
	if (pwdResult.isErr()) {
		logError({
			description: `Error getting current file: ${pwdResult.error}`,
			location: "navigatePageAction",
		});
		return;
	}

	try {
		const currentPath = pwdResult.value as SplitPathToMdFile;
		const targetPage =
			direction === "prev"
				? getPrevPageSplitPath(currentPath)
				: getNextPageSplitPath(currentPath);

		if (targetPage) {
			logger.info(`[NAV] navigatePageAction cd START direction=${direction}`);
			await vaultActionManager.cd(targetPage);
			logger.info(`[NAV] navigatePageAction cd END`);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
