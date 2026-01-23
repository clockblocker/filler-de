import {
	getNextPageSplitPath,
	getPrevPageSplitPath,
} from "../../../../commanders/librarian/bookkeeper/page-codec";
import type { Librarian } from "../../../../commanders/librarian/librarian";
import { logError } from "../../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../obsidian/vault-action-manager/types/split-path";

export async function navigatePageAction(
	librarian: Librarian,
	currentFilePath: SplitPathToMdFile,
	direction: "prev" | "next",
): Promise<void> {
	try {
		const targetPage =
			direction === "prev"
				? getPrevPageSplitPath(currentFilePath)
				: getNextPageSplitPath(currentFilePath);

		if (targetPage) {
			await librarian.navigateTo(targetPage);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
