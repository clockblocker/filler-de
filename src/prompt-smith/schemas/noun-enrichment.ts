import { z } from "zod/v3";
import {
	GermanGenusSchema,
	NounClassSchema,
} from "../../linguistics/de/lexem/noun/features";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z
	.object({
		emojiDescription: z.array(z.string().min(1).max(4)).min(1).max(3),
		genus: GermanGenusSchema.nullable().optional(),
		ipa: z.string().min(1),
		nounClass: NounClassSchema.nullable().optional(),
		senseGloss: z.string().min(3).max(120).nullable().optional(),
	})
	.strict();

export const nounEnrichmentSchemas = { agentOutputSchema, userInputSchema };
