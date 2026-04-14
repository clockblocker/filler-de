import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishAdpositionInflectionalFeaturesSchema,
	EnglishAdpositionInherentFeaturesSchema,
} from "./parts/english-adposition-features";
import {
	EnglishAdpositionLexicalRelationsSchema,
	EnglishAdpositionMorphologicalRelationsSchema,
} from "./parts/english-adposition-relations";

const EnglishAdpositionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdpositionInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdpositionLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdpositionMorphologicalRelationsSchema,
	pos: "ADP",
});

export const EnglishAdpositionInflectionSelectionSchema =
	EnglishAdpositionSchemas.InflectionSelectionSchema;
export const EnglishAdpositionLemmaSelectionSchema =
	EnglishAdpositionSchemas.LemmaSelectionSchema;
export const EnglishAdpositionStandardPartialSelectionSchema =
	EnglishAdpositionSchemas.StandardPartialSelectionSchema;
export const EnglishAdpositionStandardVariantSelectionSchema =
	EnglishAdpositionSchemas.StandardVariantSelectionSchema;
export const EnglishAdpositionTypoInflectionSelectionSchema =
	EnglishAdpositionSchemas.TypoInflectionSelectionSchema;
export const EnglishAdpositionTypoLemmaSelectionSchema =
	EnglishAdpositionSchemas.TypoLemmaSelectionSchema;
export const EnglishAdpositionTypoPartialSelectionSchema =
	EnglishAdpositionSchemas.TypoPartialSelectionSchema;
export const EnglishAdpositionTypoVariantSelectionSchema =
	EnglishAdpositionSchemas.TypoVariantSelectionSchema;
export const EnglishAdpositionLemmaSchema = EnglishAdpositionSchemas.LemmaSchema;
