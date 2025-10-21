import { Notice } from "obsidian";
import { z } from "zod";
import { prompts } from "../../../prompts";
import type { ApiService } from "../../obsidian-services/atomic-services/api-service";
import type { SelectionService } from "../../obsidian-services/atomic-services/selection-service";

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
      userInput: await selection,
      schema: z.string(),
      withCache: false,
    });

    if (!response) return;

    selectionService.appendBelow(response);
  } catch (error) {
    new Notice(`Error: ${error.message}`);
  }
}
