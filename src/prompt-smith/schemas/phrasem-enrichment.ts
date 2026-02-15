import { z } from "zod/v3";
import {
	DePhrasemEnrichmentOutputSchema,
	DePhrasemTargetSchema,
} from "../../linguistics/de/lemma";

const userInputSchema = z.object({
	context: z.string(),
	target: DePhrasemTargetSchema,
});

const agentOutputSchema = DePhrasemEnrichmentOutputSchema;

export const phrasemEnrichmentSchemas = { agentOutputSchema, userInputSchema };
