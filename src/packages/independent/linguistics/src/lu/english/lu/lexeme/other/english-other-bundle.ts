import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishOtherInflectionalFeaturesSchema,
	EnglishOtherInherentFeaturesSchema,
} from "./parts/english-other-features";
import {
	EnglishOtherLexicalRelationsSchema,
	EnglishOtherMorphologicalRelationsSchema,
} from "./parts/english-other-relations";

const EnglishOtherSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishOtherInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishOtherLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishOtherMorphologicalRelationsSchema,
	pos: "X",
});

export const EnglishOtherInflectionSelectionSchema =
	EnglishOtherSchemas.InflectionSelectionSchema;
export const EnglishOtherLemmaSelectionSchema =
	EnglishOtherSchemas.LemmaSelectionSchema;
export const EnglishOtherStandardVariantSelectionSchema =
	EnglishOtherSchemas.StandardVariantSelectionSchema;
export const EnglishOtherTypoInflectionSelectionSchema =
	EnglishOtherSchemas.TypoInflectionSelectionSchema;
export const EnglishOtherTypoLemmaSelectionSchema =
	EnglishOtherSchemas.TypoLemmaSelectionSchema;
export const EnglishOtherTypoVariantSelectionSchema =
	EnglishOtherSchemas.TypoVariantSelectionSchema;
export const EnglishOtherLemmaSchema = EnglishOtherSchemas.LemmaSchema;
