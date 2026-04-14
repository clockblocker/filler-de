import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishInterjectionInflectionalFeaturesSchema,
	EnglishInterjectionInherentFeaturesSchema,
} from "./parts/english-interjection-features";
import {
	EnglishInterjectionLexicalRelationsSchema,
	EnglishInterjectionMorphologicalRelationsSchema,
} from "./parts/english-interjection-relations";

const EnglishInterjectionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishInterjectionInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishInterjectionLexicalRelationsSchema,
	morphologicalRelationsSchema:
		EnglishInterjectionMorphologicalRelationsSchema,
	pos: "INTJ",
});

export const EnglishInterjectionInflectionSelectionSchema =
	EnglishInterjectionSchemas.InflectionSelectionSchema;
export const EnglishInterjectionLemmaSelectionSchema =
	EnglishInterjectionSchemas.LemmaSelectionSchema;
export const EnglishInterjectionStandardPartialSelectionSchema =
	EnglishInterjectionSchemas.StandardPartialSelectionSchema;
export const EnglishInterjectionStandardVariantSelectionSchema =
	EnglishInterjectionSchemas.StandardVariantSelectionSchema;
export const EnglishInterjectionTypoInflectionSelectionSchema =
	EnglishInterjectionSchemas.TypoInflectionSelectionSchema;
export const EnglishInterjectionTypoLemmaSelectionSchema =
	EnglishInterjectionSchemas.TypoLemmaSelectionSchema;
export const EnglishInterjectionTypoPartialSelectionSchema =
	EnglishInterjectionSchemas.TypoPartialSelectionSchema;
export const EnglishInterjectionTypoVariantSelectionSchema =
	EnglishInterjectionSchemas.TypoVariantSelectionSchema;
export const EnglishInterjectionLemmaSchema =
	EnglishInterjectionSchemas.LemmaSchema;
