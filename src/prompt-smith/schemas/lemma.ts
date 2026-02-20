import { z } from "zod/v3";
import { DeLemmaResultSchema } from "../../linguistics/de/lemma";

const userInputSchema = z.object({
	context: z.string(),
	surface: z.string(),
});

// Runtime cutover: Lemma validates against the minimal classifier contract.
// Enrichment/feature contracts are exported below for Generate routing.
const agentOutputSchema = DeLemmaResultSchema;

export const lemmaSchemas = { agentOutputSchema, userInputSchema };
export {
	type DeEnrichmentInput,
	DeEnrichmentInputSchema,
	type DeEnrichmentOutput,
	DeEnrichmentOutputSchema,
	type DeFeaturesInput,
	DeFeaturesInputSchema,
	type DeFeaturesOutput,
	DeFeaturesOutputSchema,
	type DeInflectionInput,
	DeInflectionInputSchema,
	type DeInflectionOutput,
	DeInflectionOutputSchema,
	type DeLemmaResult,
	DeLemmaResultSchema,
	type DeLexicalTarget,
	DeLexicalTargetSchema,
	type DeRelationInput,
	DeRelationInputSchema,
	type DeRelationOutput,
	DeRelationOutputSchema,
	type DeWordTranslationInput,
	DeWordTranslationInputSchema,
	type DeWordTranslationOutput,
	DeWordTranslationOutputSchema,
} from "../../linguistics/de/lemma";
