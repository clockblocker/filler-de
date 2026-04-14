import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAuxiliaryInflectionalFeaturesSchema,
	GermanAuxiliaryInherentFeaturesSchema,
} from "./parts/german-auxiliary-features";
import {
	GermanAuxiliaryLexicalRelationsSchema,
	GermanAuxiliaryMorphologicalRelationsSchema,
} from "./parts/german-auxiliary-relations";

const GermanAuxiliarySchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAuxiliaryInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAuxiliaryLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAuxiliaryMorphologicalRelationsSchema,
	pos: "AUX",
});

export const GermanAuxiliaryInflectionSelectionSchema =
	GermanAuxiliarySchemas.InflectionSelectionSchema;
export const GermanAuxiliaryLemmaSelectionSchema =
	GermanAuxiliarySchemas.LemmaSelectionSchema;
export const GermanAuxiliaryStandardPartialSelectionSchema =
	GermanAuxiliarySchemas.StandardPartialSelectionSchema;
export const GermanAuxiliaryStandardVariantSelectionSchema =
	GermanAuxiliarySchemas.StandardVariantSelectionSchema;
export const GermanAuxiliaryTypoInflectionSelectionSchema =
	GermanAuxiliarySchemas.TypoInflectionSelectionSchema;
export const GermanAuxiliaryTypoLemmaSelectionSchema =
	GermanAuxiliarySchemas.TypoLemmaSelectionSchema;
export const GermanAuxiliaryTypoPartialSelectionSchema =
	GermanAuxiliarySchemas.TypoPartialSelectionSchema;
export const GermanAuxiliaryTypoVariantSelectionSchema =
	GermanAuxiliarySchemas.TypoVariantSelectionSchema;
export const GermanAuxiliaryLemmaSchema = GermanAuxiliarySchemas.LemmaSchema;
