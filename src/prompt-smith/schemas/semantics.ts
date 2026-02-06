import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	semantics: z.string().min(1).max(80),
});

export const semanticsSchemas = { agentOutputSchema, userInputSchema };
