import type { TexfresserObsidianServices } from "../../../../deprecated-services/obsidian-services/interface";
import { logError } from "../../../obsidian/vault-action-manager/helpers/issue-handlers";

const SPLIT_TO_PAGES_COMMAND = "cbcr-text-eater-de:split-to-pages";

export async function makeTextAction(
	services: Partial<TexfresserObsidianServices>,
): Promise<void> {
	const { app } = services;

	if (!app) {
		logError({
			description: "Missing app for makeTextAction",
			location: "makeTextAction",
		});
		return;
	}

	// Delegate to the split-to-pages command which handles the conversion
	// biome-ignore lint/suspicious/noExplicitAny: <commands API not in official types>
	(app as any).commands.executeCommandById(SPLIT_TO_PAGES_COMMAND);
}
