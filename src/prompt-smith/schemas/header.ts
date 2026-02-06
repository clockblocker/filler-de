import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	article: z.enum(["der", "die", "das"]).nullable().optional(),
	emoji: z.string().min(1).max(4),
	ipa: z.string().min(1),
});

export const headerSchemas = { agentOutputSchema, userInputSchema };
