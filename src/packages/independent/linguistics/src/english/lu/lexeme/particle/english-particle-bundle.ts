import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishParticleInflectionalFeaturesSchema,
	EnglishParticleInherentFeaturesSchema,
} from "./parts/english-particle-features";
import {
	EnglishParticleLexicalRelationsSchema,
	EnglishParticleMorphologicalRelationsSchema,
} from "./parts/english-particle-relations";

const EnglishParticleSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishParticleInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishParticleLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishParticleMorphologicalRelationsSchema,
	pos: "PART",
});

export const EnglishParticleInflectionSelectionSchema =
	EnglishParticleSchemas.InflectionSelectionSchema;
export const EnglishParticleLemmaSelectionSchema =
	EnglishParticleSchemas.LemmaSelectionSchema;
export const EnglishParticleStandardPartialSelectionSchema =
	EnglishParticleSchemas.StandardPartialSelectionSchema;
export const EnglishParticleStandardVariantSelectionSchema =
	EnglishParticleSchemas.StandardVariantSelectionSchema;
export const EnglishParticleTypoInflectionSelectionSchema =
	EnglishParticleSchemas.TypoInflectionSelectionSchema;
export const EnglishParticleTypoLemmaSelectionSchema =
	EnglishParticleSchemas.TypoLemmaSelectionSchema;
export const EnglishParticleTypoPartialSelectionSchema =
	EnglishParticleSchemas.TypoPartialSelectionSchema;
export const EnglishParticleTypoVariantSelectionSchema =
	EnglishParticleSchemas.TypoVariantSelectionSchema;
export const EnglishParticleLemmaSchema = EnglishParticleSchemas.LemmaSchema;
