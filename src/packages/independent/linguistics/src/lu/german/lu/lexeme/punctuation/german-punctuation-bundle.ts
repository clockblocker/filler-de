import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanPunctuationInflectionalFeaturesSchema,
	GermanPunctuationInherentFeaturesSchema,
} from "./parts/german-punctuation-features";
import {
	GermanPunctuationLexicalRelationsSchema,
	GermanPunctuationMorphologicalRelationsSchema,
} from "./parts/german-punctuation-relations";

const GermanPunctuationSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPunctuationInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPunctuationInherentFeaturesSchema,
	lexicalRelationsSchema: GermanPunctuationLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanPunctuationMorphologicalRelationsSchema,
	pos: "PUNCT",
});

export const GermanPunctuationInflectionSelectionSchema =
	GermanPunctuationSchemas.InflectionSelectionSchema;
export const GermanPunctuationLemmaSelectionSchema =
	GermanPunctuationSchemas.LemmaSelectionSchema;
export const GermanPunctuationStandardPartialSelectionSchema =
	GermanPunctuationSchemas.StandardPartialSelectionSchema;
export const GermanPunctuationStandardVariantSelectionSchema =
	GermanPunctuationSchemas.StandardVariantSelectionSchema;
export const GermanPunctuationTypoInflectionSelectionSchema =
	GermanPunctuationSchemas.TypoInflectionSelectionSchema;
export const GermanPunctuationTypoLemmaSelectionSchema =
	GermanPunctuationSchemas.TypoLemmaSelectionSchema;
export const GermanPunctuationTypoPartialSelectionSchema =
	GermanPunctuationSchemas.TypoPartialSelectionSchema;
export const GermanPunctuationTypoVariantSelectionSchema =
	GermanPunctuationSchemas.TypoVariantSelectionSchema;
export const GermanPunctuationLemmaSchema =
	GermanPunctuationSchemas.LemmaSchema;
