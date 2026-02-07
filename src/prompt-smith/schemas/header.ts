import { z } from "zod/v3";
import { GermanGenusSchema } from "../../linguistics/german/enums/genus";

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	emoji: z.string().min(1).max(4),
	genus: GermanGenusSchema.nullable().optional(),
	ipa: z.string().min(1),
});

export const headerSchemas = { agentOutputSchema, userInputSchema };
