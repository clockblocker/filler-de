import { z } from "zod/v3";
import {
	DeLexemEnrichmentOutputSchema,
	DeLexemTargetSchema,
} from "../../linguistics/de/lemma";

const userInputSchema = z.object({
	context: z.string(),
	target: DeLexemTargetSchema,
});

const agentOutputSchema = DeLexemEnrichmentOutputSchema;

export const lexemEnrichmentSchemas = { agentOutputSchema, userInputSchema };
