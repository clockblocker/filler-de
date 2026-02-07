import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	lemma: z.string(),
	senses: z.array(
		z.object({
			emojiDescription: z.array(z.string()),
			genus: z.string().optional(),
			index: z.number(),
			pos: z.string().optional(),
			unitKind: z.string(),
		}),
	),
});

const agentOutputSchema = z.object({
	/** When matchedIndex is null (new sense), 1-3 emojis distinguishing this sense. */
	emojiDescription: z
		.array(z.string().min(1).max(4))
		.min(1)
		.max(3)
		.nullable()
		.optional(),
	matchedIndex: z.number().nullable(),
});

export const disambiguateSchemas = { agentOutputSchema, userInputSchema };
