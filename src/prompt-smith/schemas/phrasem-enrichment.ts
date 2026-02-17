import { z } from "zod/v3";

const userInputSchema = z.object({
	context: z.string(),
	kind: z.string(),
	word: z.string(),
});

const agentOutputSchema = z
	.object({
		emojiDescription: z.array(z.string().min(1).max(4)).min(1).max(3),
		ipa: z.string().min(1),
		senseGloss: z.string().min(3).max(120).nullable().optional(),
	})
	.strict();

export const phrasemEnrichmentSchemas = { agentOutputSchema, userInputSchema };
