import { z } from "zod/v3";
import { PhrasemSurfaceSchema } from "../common/dto/phrasem-surface";
import { GermanLexemSurfaceSchema } from "./lexem";
import { GermanMorphemSurfaceSchema } from "./morphem";

export const GermanLinguisticUnitSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("Lexem"),
		surface: GermanLexemSurfaceSchema,
	}),
	z.object({
		kind: z.literal("Phrasem"),
		surface: PhrasemSurfaceSchema,
	}),
	z.object({
		kind: z.literal("Morphem"),
		surface: GermanMorphemSurfaceSchema,
	}),
]);
export type GermanLinguisticUnit = z.infer<typeof GermanLinguisticUnitSchema>;

export {
	DE_LEMMA_LINGUISTIC_UNITS,
	DE_LEXEM_POS,
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
	DeLemmaLinguisticUnit,
	DeLemmaLinguisticUnitSchema,
	type DeLemmaResult,
	DeLemmaResultSchema,
	DeLexemLemmaResultSchema,
	type DeLexemPos,
	DeLexemPosSchema,
	type DeLexemTarget,
	DeLexemTargetSchema,
	type DeLexicalTarget,
	DeLexicalTargetSchema,
	DePhrasemLemmaResultSchema,
	type DePhrasemTarget,
	DePhrasemTargetSchema,
	type DePosLikeKind,
	DePosLikeKindSchema,
	type DeRelationInput,
	DeRelationInputSchema,
	type DeRelationOutput,
	DeRelationOutputSchema,
	type DeRelationSubKind,
	DeRelationSubKindSchema,
	type DeWordTranslationInput,
	DeWordTranslationInputSchema,
	type DeWordTranslationOutput,
	DeWordTranslationOutputSchema,
	isDeLexemTarget,
	isDePhrasemTarget,
	toDeLexicalTarget,
} from "./lemma";
export {
	type GermanLexemSurface,
	GermanLexemSurfaceSchema,
} from "./lexem";
// Barrel exports
export {
	articleFromGenus,
	GermanGenus,
	GermanGenusSchema,
} from "./lexem/noun/features";
export {
	type GermanMorphemSurface,
	GermanMorphemSurfaceSchema,
} from "./morphem";
