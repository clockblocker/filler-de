import { z } from "zod/v3";
import { DE_LEMMA_LINGUISTIC_UNITS, DE_LEXEM_POS } from "../../contracts/de";
import {
	LEXICAL_PHRASEME_KIND_VALUES,
	LexicalSurfaceKindSchema,
} from "../../schema-primitives";

const userInputSchema = z.object({
	context: z.string(),
	surface: z.string(),
});

const lemmaPromptPosLikeKinds = [
	...DE_LEXEM_POS,
	...LEXICAL_PHRASEME_KIND_VALUES,
] as const;

// Keep the API-facing schema flat: Gemini rejects the recursive JSON schema
// emitted for the discriminated union form used by the stricter runtime contract.
const agentOutputSchema = z.object({
	contextWithLinkedParts: z.string(),
	lemma: z.string(),
	linguisticUnit: z.enum(DE_LEMMA_LINGUISTIC_UNITS),
	posLikeKind: z.enum(lemmaPromptPosLikeKinds),
	surfaceKind: LexicalSurfaceKindSchema,
});

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
} from "../../contracts/de";
