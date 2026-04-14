import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishAuxiliaryInflectionalFeaturesSchema,
	EnglishAuxiliaryInherentFeaturesSchema,
} from "./parts/english-auxiliary-features";
import {
	EnglishAuxiliaryLexicalRelationsSchema,
	EnglishAuxiliaryMorphologicalRelationsSchema,
} from "./parts/english-auxiliary-relations";

const EnglishAuxiliarySchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAuxiliaryInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAuxiliaryLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAuxiliaryMorphologicalRelationsSchema,
	pos: "AUX",
});

export const EnglishAuxiliaryInflectionSelectionSchema =
	EnglishAuxiliarySchemas.InflectionSelectionSchema;
export const EnglishAuxiliaryLemmaSelectionSchema =
	EnglishAuxiliarySchemas.LemmaSelectionSchema;
export const EnglishAuxiliaryStandardPartialSelectionSchema =
	EnglishAuxiliarySchemas.StandardPartialSelectionSchema;
export const EnglishAuxiliaryStandardVariantSelectionSchema =
	EnglishAuxiliarySchemas.StandardVariantSelectionSchema;
export const EnglishAuxiliaryTypoInflectionSelectionSchema =
	EnglishAuxiliarySchemas.TypoInflectionSelectionSchema;
export const EnglishAuxiliaryTypoLemmaSelectionSchema =
	EnglishAuxiliarySchemas.TypoLemmaSelectionSchema;
export const EnglishAuxiliaryTypoPartialSelectionSchema =
	EnglishAuxiliarySchemas.TypoPartialSelectionSchema;
export const EnglishAuxiliaryTypoVariantSelectionSchema =
	EnglishAuxiliarySchemas.TypoVariantSelectionSchema;
export const EnglishAuxiliaryLemmaSchema = EnglishAuxiliarySchemas.LemmaSchema;
