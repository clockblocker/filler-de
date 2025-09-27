import { Notice } from 'obsidian';
import { ApiService } from 'services/api-service';
import { SelectionService } from 'services/selection-service';
import { prompts } from 'prompts';
import { z } from 'zod';

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
			systemPrompt: prompts.translate_de_to_eng,
			userInput: selection,
			schema: z.string(),
			withCache: false,
		});

		if (!response) return;

		selectionService.appendBelow(response);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
