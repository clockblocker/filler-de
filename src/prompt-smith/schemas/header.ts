import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	article: z.string().nullable().optional(),
	emoji: z.string(),
	ipa: z.string(),
});

export const headerSchemas = { agentOutputSchema, userInputSchema };
