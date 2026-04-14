import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanParticleInflectionalFeaturesSchema,
	GermanParticleInherentFeaturesSchema,
} from "./parts/german-particle-features";
import {
	GermanParticleLexicalRelationsSchema,
	GermanParticleMorphologicalRelationsSchema,
} from "./parts/german-particle-relations";

const GermanParticleSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanParticleInherentFeaturesSchema,
	lexicalRelationsSchema: GermanParticleLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanParticleMorphologicalRelationsSchema,
	pos: "PART",
});

export const GermanParticleInflectionSelectionSchema =
	GermanParticleSchemas.InflectionSelectionSchema;
export const GermanParticleLemmaSelectionSchema =
	GermanParticleSchemas.LemmaSelectionSchema;
export const GermanParticleStandardVariantSelectionSchema =
	GermanParticleSchemas.StandardVariantSelectionSchema;
export const GermanParticleTypoInflectionSelectionSchema =
	GermanParticleSchemas.TypoInflectionSelectionSchema;
export const GermanParticleTypoLemmaSelectionSchema =
	GermanParticleSchemas.TypoLemmaSelectionSchema;
export const GermanParticleTypoVariantSelectionSchema =
	GermanParticleSchemas.TypoVariantSelectionSchema;
export const GermanParticleLemmaSchema = GermanParticleSchemas.LemmaSchema;
