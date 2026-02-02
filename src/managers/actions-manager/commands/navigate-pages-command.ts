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
	vam: VaultActionManager,
	direction: Direction,
): Promise<void> {
	try {
		// Get current file path
		const pwdResult = await vam.pwd();
		if (pwdResult.isErr() || pwdResult.value.kind !== "MdFile") {
			return;
		}
		const currentFilePath = pwdResult.value;

		// Read current file content to get navigation indices
		const contentResult = await vam.getOpenedContent();
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
			await vam.cd(targetPage);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: `goTo${direction === "prev" ? "Prev" : "Next"}PageCommand`,
		});
	}
}

export async function goToPrevPageCommand(
	vam: VaultActionManager,
): Promise<void> {
	await navigateToPage(vam, "prev");
}

export async function goToNextPageCommand(
	vam: VaultActionManager,
): Promise<void> {
	await navigateToPage(vam, "next");
}
