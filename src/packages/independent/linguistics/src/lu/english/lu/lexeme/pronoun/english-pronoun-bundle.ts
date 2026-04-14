import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishPronounInflectionalFeaturesSchema,
	EnglishPronounInherentFeaturesSchema,
} from "./parts/english-pronoun-features";
import {
	EnglishPronounLexicalRelationsSchema,
	EnglishPronounMorphologicalRelationsSchema,
} from "./parts/english-pronoun-relations";

const EnglishPronounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPronounInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishPronounLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishPronounMorphologicalRelationsSchema,
	pos: "PRON",
});

export const EnglishPronounInflectionSelectionSchema =
	EnglishPronounSchemas.InflectionSelectionSchema;
export const EnglishPronounLemmaSelectionSchema =
	EnglishPronounSchemas.LemmaSelectionSchema;
export const EnglishPronounStandardVariantSelectionSchema =
	EnglishPronounSchemas.StandardVariantSelectionSchema;
export const EnglishPronounTypoInflectionSelectionSchema =
	EnglishPronounSchemas.TypoInflectionSelectionSchema;
export const EnglishPronounTypoLemmaSelectionSchema =
	EnglishPronounSchemas.TypoLemmaSelectionSchema;
export const EnglishPronounTypoVariantSelectionSchema =
	EnglishPronounSchemas.TypoVariantSelectionSchema;
export const EnglishPronounLemmaSchema = EnglishPronounSchemas.LemmaSchema;
