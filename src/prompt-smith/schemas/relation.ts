import { z } from "zod/v3";

export const RelationSubKindSchema = z.enum([
	"Synonym",
	"NearSynonym",
	"Antonym",
	"Hypernym",
	"Hyponym",
	"Meronym",
	"Holonym",
]);

export type RelationSubKind = z.infer<typeof RelationSubKindSchema>;

const userInputSchema = z.object({
	context: z.string(),
	pos: z.string(),
	word: z.string(),
});

const agentOutputSchema = z.object({
	relations: z.array(
		z.object({
			kind: RelationSubKindSchema,
			words: z.array(z.string()),
		}),
	),
});

export const relationSchemas = { agentOutputSchema, userInputSchema };
