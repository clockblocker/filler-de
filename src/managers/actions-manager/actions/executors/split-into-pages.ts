import { splitToPagesAction } from "../../../../commanders/librarian/bookkeeper/split-to-pages-action";
import type { TexfresserObsidianServices } from "../../../../deprecated-services/obsidian-services/interface";
import { logError } from "../../../obsidian/vault-action-manager/helpers/issue-handlers";

export async function splitIntoPagesAction(
	services: Partial<TexfresserObsidianServices>,
): Promise<void> {
	const { vaultActionManager, librarian } = services;

	if (!vaultActionManager) {
		logError({
			description: "Missing vaultActionManager for splitIntoPagesAction",
			location: "splitIntoPagesAction",
		});
		return;
	}

	await splitToPagesAction({
		onSectionCreated: (info) => {
			// Notify librarian to create codex (bypasses self-event filtering)
			librarian?.triggerSectionHealing(info);
		},
		openedFileService: vaultActionManager.openedFileService,
		vaultActionManager,
	});
}
