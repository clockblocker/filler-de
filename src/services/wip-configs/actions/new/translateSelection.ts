import { Notice } from "obsidian";
import { z } from "zod";
import type { ApiService } from "../../../obsidian-services/atomic-services/api-service";
import type { SelectionService } from "../../../obsidian-services/atomic-services/selection-service";
import { prompts } from "../../../prompts";

export default async function newTranslateSelection({
	selectionService,
	apiService,
}: {
	selectionService: SelectionService;
	apiService: ApiService;
}) {
	try {
		const selection = selectionService.getSelection();

		const response = await apiService.generate({
			schema: z.string(),
			systemPrompt: prompts.translate_de_to_eng,
			userInput: await selection,
			withCache: false,
		});

		if (!response) return;

		selectionService.appendBelow(response);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
