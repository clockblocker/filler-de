import { z } from "zod";
import { getPageSplitPathByIndex } from "../../../commanders/librarian/bookkeeper/page-codec";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";
import { logError } from "../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";

/** Schema for reading page navigation metadata */
const PageNavMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
	})
	.passthrough();

export type NavigatePagePayload = {
	direction: "prev" | "next";
	currentFilePath: SplitPathToMdFile;
};

export type NavigatePageCommand = (
	payload: NavigatePagePayload,
) => Promise<void>;

export function makeNavigatePageCommand(
	_librarian: unknown, // Kept for API compatibility, no longer used
	vaultActionManager: VaultActionManager,
): NavigatePageCommand {
	return async (payload: NavigatePagePayload): Promise<void> => {
		const { direction, currentFilePath } = payload;

		try {
			// Read current file content to get navigation indices
			const contentResult = await vaultActionManager.getOpenedContent();
			if (contentResult.isErr()) {
				logError({
					description: `Error reading file content: ${contentResult.error}`,
					location: "navigatePageCommand",
				});
				return;
			}

			const metadata = noteMetadataHelper.read(
				contentResult.value,
				PageNavMetadataSchema,
			);
			if (!metadata || metadata.noteKind !== "Page") {
				return;
			}

			const targetIdx =
				direction === "prev"
					? metadata.prevPageIdx
					: metadata.nextPageIdx;

			if (targetIdx === undefined) {
				return;
			}

			const targetPage = getPageSplitPathByIndex(
				currentFilePath,
				targetIdx,
			);
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
