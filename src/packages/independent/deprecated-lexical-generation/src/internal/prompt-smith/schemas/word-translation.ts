import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.string().describe("Translated word or phrase");

export const wordTranslationSchemas = { agentOutputSchema, userInputSchema };
