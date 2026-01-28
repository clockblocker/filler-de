import type { Librarian } from "../../../commanders/librarian/librarian";
import { splitToPagesAction } from "../../../commanders/librarian/bookkeeper/split-to-pages-action";
import { logError } from "../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";

type SplitIntoPagesServices = {
	vaultActionManager?: VaultActionManager;
	librarian?: Librarian | null;
};

export async function splitIntoPagesCommand(
	services: SplitIntoPagesServices,
): Promise<void> {
	const { vaultActionManager, librarian } = services;

	if (!vaultActionManager) {
		logError({
			description: "Missing vaultActionManager for splitIntoPagesCommand",
			location: "splitIntoPagesCommand",
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
