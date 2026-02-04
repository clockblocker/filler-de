import { splitToPagesAction } from "../../../commanders/librarian/bookkeeper/split-to-pages-action";
import type { Librarian } from "../../../commanders/librarian/librarian";
import type { VaultActionManager } from "../../obsidian/vault-action-manager";
import { logError } from "../../obsidian/vault-action-manager/helpers/issue-handlers";

type SplitIntoPagesServices = {
	vam?: VaultActionManager;
	librarian?: Librarian | null;
};

export async function splitIntoPagesCommand(
	services: SplitIntoPagesServices,
): Promise<void> {
	const { vam, librarian } = services;

	if (!vam) {
		logError({
			description: "Missing vam for splitIntoPagesCommand",
			location: "splitIntoPagesCommand",
		});
		return;
	}

	await splitToPagesAction({
		activeFileService: vam.activeFileService,
		onSectionCreated: (info) => {
			// Notify librarian to create codex (bypasses self-event filtering)
			librarian?.triggerSectionHealing(info);
		},
		vam,
	});
}
