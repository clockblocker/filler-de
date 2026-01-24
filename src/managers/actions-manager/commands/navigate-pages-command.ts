import type { Librarian } from "../../../commanders/librarian/librarian";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";
import { logError } from "../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

export type NavigatePagePayload = {
	direction: "prev" | "next";
	currentFilePath: SplitPathToMdFile;
};

export type NavigatePageCommand = (
	payload: NavigatePagePayload,
) => Promise<void>;

export function makeNavigatePageCommand(
	librarian: Librarian | null,
	vaultActionManager: VaultActionManager,
): NavigatePageCommand {
	return async (payload: NavigatePagePayload): Promise<void> => {
		const { direction, currentFilePath } = payload;

		try {
			const targetPage =
				librarian === null
					? null
					: direction === "prev"
						? librarian.getPrevPage(currentFilePath)
						: librarian.getNextPage(currentFilePath);

			if (targetPage) {
				await vaultActionManager.cd(targetPage);
			}
		} catch (error) {
			logError({
				description: `Error navigating to ${direction} page: ${error}`,
				location: "navigatePageCommand",
			});
		}
	};
}
