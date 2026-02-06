import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	semantics: z.string(),
});

export const semanticsSchemas = { agentOutputSchema, userInputSchema };
