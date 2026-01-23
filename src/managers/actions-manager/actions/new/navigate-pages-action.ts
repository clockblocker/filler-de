import {
	getNextPageSplitPath,
	getPrevPageSplitPath,
} from "../../../../commanders/librarian/bookkeeper/page-codec";
import type { TexfresserObsidianServices } from "../../../../deprecated-services/obsidian-services/interface";
import { logError } from "../../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../obsidian/vault-action-manager/types/split-path";

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
			await vaultActionManager.cd(targetPage);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
