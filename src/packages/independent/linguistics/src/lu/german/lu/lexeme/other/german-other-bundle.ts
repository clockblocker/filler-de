import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanOtherInflectionalFeaturesSchema,
	GermanOtherInherentFeaturesSchema,
} from "./parts/german-other-features";
import {
	GermanOtherLexicalRelationsSchema,
	GermanOtherMorphologicalRelationsSchema,
} from "./parts/german-other-relations";

const GermanOtherSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanOtherInherentFeaturesSchema,
	lexicalRelationsSchema: GermanOtherLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanOtherMorphologicalRelationsSchema,
	pos: "X",
});

export const GermanOtherInflectionSelectionSchema =
	GermanOtherSchemas.InflectionSelectionSchema;
export const GermanOtherLemmaSelectionSchema =
	GermanOtherSchemas.LemmaSelectionSchema;
export const GermanOtherStandardVariantSelectionSchema =
	GermanOtherSchemas.StandardVariantSelectionSchema;
export const GermanOtherTypoInflectionSelectionSchema =
	GermanOtherSchemas.TypoInflectionSelectionSchema;
export const GermanOtherTypoLemmaSelectionSchema =
	GermanOtherSchemas.TypoLemmaSelectionSchema;
export const GermanOtherTypoVariantSelectionSchema =
	GermanOtherSchemas.TypoVariantSelectionSchema;
export const GermanOtherLemmaSchema = GermanOtherSchemas.LemmaSchema;
