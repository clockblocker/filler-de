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
	type GermanLexemSurface,
	GermanLexemSurfaceSchema,
} from "./lexem";
export * from "./schema-primitives";
export {
	type GermanAdjectiveClassification,
	GermanAdjectiveClassificationSchema,
	type GermanAdjectiveDistribution,
	GermanAdjectiveDistributionSchema,
	type GermanAdjectiveFullFeatures,
	GermanAdjectiveFullFeaturesSchema,
	type GermanAdjectiveGovernedPattern,
	GermanAdjectiveGovernedPatternSchema,
	type GermanAdjectiveGradability,
	GermanAdjectiveGradabilitySchema,
	type GermanAdjectiveRefFeatures,
	GermanAdjectiveRefFeaturesSchema,
	type GermanAdjectiveValency,
	GermanAdjectiveValencySchema,
} from "./lexem/adjective/features";
export {
	articleFromGenus,
	GermanGenus,
	GermanGenusSchema,
} from "./lexem/noun/features";
export {
	buildGermanVerbEntryIdentity,
	type GermanVerbConjugation,
	GermanVerbConjugationSchema,
	type GermanVerbFullFeatures,
	GermanVerbFullFeaturesSchema,
	type GermanVerbRefFeatures,
	GermanVerbRefFeaturesSchema,
	type GermanVerbReflexivity,
	GermanVerbReflexivitySchema,
	type GermanVerbSeparability,
	GermanVerbSeparabilitySchema,
	type GermanVerbValency,
	GermanVerbValencySchema,
} from "./lexem/verb/features";
export {
	type GermanMorphemSurface,
	GermanMorphemSurfaceSchema,
} from "./morphem";
export {
	type GermanMorphemeKind,
	GERMAN_MORPHEME_KINDS,
	GermanMorphemeKindSchema,
} from "./morphem/de-morphem-kind";
