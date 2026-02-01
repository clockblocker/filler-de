import { z } from "zod";
import { getPageSplitPathByIndex } from "../../../commanders/librarian/bookkeeper/page-codec";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";
import { logError } from "../../obsidian/vault-action-manager/helpers/issue-handlers";

/** Schema for reading page navigation metadata */
const PageNavMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
	})
	.passthrough();

type Direction = "prev" | "next";

async function navigateToPage(
	vaultActionManager: VaultActionManager,
	direction: Direction,
): Promise<void> {
	try {
		// Get current file path
		const pwdResult = await vaultActionManager.pwd();
		if (pwdResult.isErr() || pwdResult.value.kind !== "MdFile") {
			return;
		}
		const currentFilePath = pwdResult.value;

		// Read current file content to get navigation indices
		const contentResult = await vaultActionManager.getOpenedContent();
		if (contentResult.isErr()) {
			logError({
				description: `Error reading file content: ${contentResult.error}`,
				location: `goTo${direction === "prev" ? "Prev" : "Next"}PageCommand`,
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
			direction === "prev" ? metadata.prevPageIdx : metadata.nextPageIdx;

		if (targetIdx === undefined) {
			return;
		}

		const targetPage = getPageSplitPathByIndex(currentFilePath, targetIdx);
		if (targetPage) {
			await vaultActionManager.cd(targetPage);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: `goTo${direction === "prev" ? "Prev" : "Next"}PageCommand`,
		});
	}
}

export async function goToPrevPageCommand(
	vaultActionManager: VaultActionManager,
): Promise<void> {
	await navigateToPage(vaultActionManager, "prev");
}

export async function goToNextPageCommand(
	vaultActionManager: VaultActionManager,
): Promise<void> {
	await navigateToPage(vaultActionManager, "next");
}
