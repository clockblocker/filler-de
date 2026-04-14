import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanPronounInflectionalFeaturesSchema,
	GermanPronounInherentFeaturesSchema,
} from "./parts/german-pronoun-features";
import {
	GermanPronounLexicalRelationsSchema,
	GermanPronounMorphologicalRelationsSchema,
} from "./parts/german-pronoun-relations";

const GermanPronounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPronounInherentFeaturesSchema,
	lexicalRelationsSchema: GermanPronounLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanPronounMorphologicalRelationsSchema,
	pos: "PRON",
});

export const GermanPronounInflectionSelectionSchema =
	GermanPronounSchemas.InflectionSelectionSchema;
export const GermanPronounLemmaSelectionSchema =
	GermanPronounSchemas.LemmaSelectionSchema;
export const GermanPronounStandardPartialSelectionSchema =
	GermanPronounSchemas.StandardPartialSelectionSchema;
export const GermanPronounStandardVariantSelectionSchema =
	GermanPronounSchemas.StandardVariantSelectionSchema;
export const GermanPronounTypoInflectionSelectionSchema =
	GermanPronounSchemas.TypoInflectionSelectionSchema;
export const GermanPronounTypoLemmaSelectionSchema =
	GermanPronounSchemas.TypoLemmaSelectionSchema;
export const GermanPronounTypoPartialSelectionSchema =
	GermanPronounSchemas.TypoPartialSelectionSchema;
export const GermanPronounTypoVariantSelectionSchema =
	GermanPronounSchemas.TypoVariantSelectionSchema;
export const GermanPronounLemmaSchema = GermanPronounSchemas.LemmaSchema;
