import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanProperNounInflectionalFeaturesSchema,
	GermanProperNounInherentFeaturesSchema,
} from "./parts/german-proper-noun-features";
import {
	GermanProperNounLexicalRelationsSchema,
	GermanProperNounMorphologicalRelationsSchema,
} from "./parts/german-proper-noun-relations";

const GermanProperNounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanProperNounInherentFeaturesSchema,
	lexicalRelationsSchema: GermanProperNounLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanProperNounMorphologicalRelationsSchema,
	pos: "PROPN",
});

export const GermanProperNounInflectionSelectionSchema =
	GermanProperNounSchemas.InflectionSelectionSchema;
export const GermanProperNounLemmaSelectionSchema =
	GermanProperNounSchemas.LemmaSelectionSchema;
export const GermanProperNounStandardPartialSelectionSchema =
	GermanProperNounSchemas.StandardPartialSelectionSchema;
export const GermanProperNounStandardVariantSelectionSchema =
	GermanProperNounSchemas.StandardVariantSelectionSchema;
export const GermanProperNounTypoInflectionSelectionSchema =
	GermanProperNounSchemas.TypoInflectionSelectionSchema;
export const GermanProperNounTypoLemmaSelectionSchema =
	GermanProperNounSchemas.TypoLemmaSelectionSchema;
export const GermanProperNounTypoPartialSelectionSchema =
	GermanProperNounSchemas.TypoPartialSelectionSchema;
export const GermanProperNounTypoVariantSelectionSchema =
	GermanProperNounSchemas.TypoVariantSelectionSchema;
export const GermanProperNounLemmaSchema = GermanProperNounSchemas.LemmaSchema;
