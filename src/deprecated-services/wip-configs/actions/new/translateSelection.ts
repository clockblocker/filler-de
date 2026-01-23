import { Notice } from "obsidian";
import { z } from "zod";
import type { OpenedFileService } from "../../../../managers/obsidian/vault-action-manager/file-services/active-view/opened-file-service";
import type { ApiService } from "../../../obsidian-services/atomic-services/api-service";
import { prompts } from "../../../prompts";

export default async function newTranslateSelection({
	openedFileService,
	apiService,
}: {
	openedFileService: OpenedFileService;
	apiService: ApiService;
}) {
	try {
		const selection = openedFileService.getSelection();
		if (!selection) {
			throw new Error("No selection");
		}

		const response = await apiService.generate({
			schema: z.string(),
			systemPrompt: prompts.translate_de_to_eng,
			userInput: selection,
			withCache: false,
		});

		if (!response) return;

		openedFileService.insertBelowCursor(response);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
