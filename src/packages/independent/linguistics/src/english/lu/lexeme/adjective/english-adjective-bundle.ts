import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishAdjectiveInflectionalFeaturesSchema,
	EnglishAdjectiveInherentFeaturesSchema,
} from "./parts/english-adjective-features";
import {
	EnglishAdjectiveLexicalRelationsSchema,
	EnglishAdjectiveMorphologicalRelationsSchema,
} from "./parts/english-adjective-relations";

const EnglishAdjectiveSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdjectiveInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdjectiveLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdjectiveMorphologicalRelationsSchema,
	pos: "ADJ",
});

export const EnglishAdjectiveInflectionSelectionSchema =
	EnglishAdjectiveSchemas.InflectionSelectionSchema;
export const EnglishAdjectiveLemmaSelectionSchema =
	EnglishAdjectiveSchemas.LemmaSelectionSchema;
export const EnglishAdjectiveStandardPartialSelectionSchema =
	EnglishAdjectiveSchemas.StandardPartialSelectionSchema;
export const EnglishAdjectiveStandardVariantSelectionSchema =
	EnglishAdjectiveSchemas.StandardVariantSelectionSchema;
export const EnglishAdjectiveTypoInflectionSelectionSchema =
	EnglishAdjectiveSchemas.TypoInflectionSelectionSchema;
export const EnglishAdjectiveTypoLemmaSelectionSchema =
	EnglishAdjectiveSchemas.TypoLemmaSelectionSchema;
export const EnglishAdjectiveTypoPartialSelectionSchema =
	EnglishAdjectiveSchemas.TypoPartialSelectionSchema;
export const EnglishAdjectiveTypoVariantSelectionSchema =
	EnglishAdjectiveSchemas.TypoVariantSelectionSchema;
export const EnglishAdjectiveLemmaSchema = EnglishAdjectiveSchemas.LemmaSchema;
