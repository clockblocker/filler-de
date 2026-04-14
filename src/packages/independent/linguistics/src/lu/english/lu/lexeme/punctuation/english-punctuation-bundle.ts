import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishPunctuationInflectionalFeaturesSchema,
	EnglishPunctuationInherentFeaturesSchema,
} from "./parts/english-punctuation-features";
import {
	EnglishPunctuationLexicalRelationsSchema,
	EnglishPunctuationMorphologicalRelationsSchema,
} from "./parts/english-punctuation-relations";

const EnglishPunctuationSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPunctuationInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishPunctuationLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishPunctuationMorphologicalRelationsSchema,
	pos: "PUNCT",
});

export const EnglishPunctuationInflectionSelectionSchema =
	EnglishPunctuationSchemas.InflectionSelectionSchema;
export const EnglishPunctuationLemmaSelectionSchema =
	EnglishPunctuationSchemas.LemmaSelectionSchema;
export const EnglishPunctuationStandardPartialSelectionSchema =
	EnglishPunctuationSchemas.StandardPartialSelectionSchema;
export const EnglishPunctuationStandardVariantSelectionSchema =
	EnglishPunctuationSchemas.StandardVariantSelectionSchema;
export const EnglishPunctuationTypoInflectionSelectionSchema =
	EnglishPunctuationSchemas.TypoInflectionSelectionSchema;
export const EnglishPunctuationTypoLemmaSelectionSchema =
	EnglishPunctuationSchemas.TypoLemmaSelectionSchema;
export const EnglishPunctuationTypoPartialSelectionSchema =
	EnglishPunctuationSchemas.TypoPartialSelectionSchema;
export const EnglishPunctuationTypoVariantSelectionSchema =
	EnglishPunctuationSchemas.TypoVariantSelectionSchema;
export const EnglishPunctuationLemmaSchema =
	EnglishPunctuationSchemas.LemmaSchema;
