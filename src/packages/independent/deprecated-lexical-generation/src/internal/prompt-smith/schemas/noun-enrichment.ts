import { z } from "zod/v3";
import {
	LexicalGenusSchema,
	LexicalNounClassSchema,
} from "../../schema-primitives";

const userInputSchema = z.object({
	context: z.string(),
	word: z.string(),
});

const agentOutputSchema = z
	.object({
		senseEmojis: z.array(z.string().min(1).max(20)).min(1).max(3),
		genus: LexicalGenusSchema.nullable().optional(),
		ipa: z.string().min(1),
		nounClass: LexicalNounClassSchema.nullable().optional(),
		senseGloss: z.string().min(3).max(120).nullable().optional(),
	})
	.strict();

export const nounEnrichmentSchemas = { agentOutputSchema, userInputSchema };
