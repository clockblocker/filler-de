import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishProperNounInflectionalFeaturesSchema,
	EnglishProperNounInherentFeaturesSchema,
} from "./parts/english-proper-noun-features";
import {
	EnglishProperNounLexicalRelationsSchema,
	EnglishProperNounMorphologicalRelationsSchema,
} from "./parts/english-proper-noun-relations";

const EnglishProperNounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishProperNounInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishProperNounLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishProperNounMorphologicalRelationsSchema,
	pos: "PROPN",
});

export const EnglishProperNounInflectionSelectionSchema =
	EnglishProperNounSchemas.InflectionSelectionSchema;
export const EnglishProperNounLemmaSelectionSchema =
	EnglishProperNounSchemas.LemmaSelectionSchema;
export const EnglishProperNounStandardPartialSelectionSchema =
	EnglishProperNounSchemas.StandardPartialSelectionSchema;
export const EnglishProperNounStandardVariantSelectionSchema =
	EnglishProperNounSchemas.StandardVariantSelectionSchema;
export const EnglishProperNounTypoInflectionSelectionSchema =
	EnglishProperNounSchemas.TypoInflectionSelectionSchema;
export const EnglishProperNounTypoLemmaSelectionSchema =
	EnglishProperNounSchemas.TypoLemmaSelectionSchema;
export const EnglishProperNounTypoPartialSelectionSchema =
	EnglishProperNounSchemas.TypoPartialSelectionSchema;
export const EnglishProperNounTypoVariantSelectionSchema =
	EnglishProperNounSchemas.TypoVariantSelectionSchema;
export const EnglishProperNounLemmaSchema = EnglishProperNounSchemas.LemmaSchema;
