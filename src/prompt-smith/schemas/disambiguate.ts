import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	lemma: z.string(),
	senses: z.array(
		z.object({
			index: z.number(),
			semantics: z.string(),
		}),
	),
});

const agentOutputSchema = z.object({
	matchedIndex: z.number().nullable(),
});

export const disambiguateSchemas = { agentOutputSchema, userInputSchema };
