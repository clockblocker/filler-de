import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishAdverbInflectionalFeaturesSchema,
	EnglishAdverbInherentFeaturesSchema,
} from "./parts/english-adverb-features";
import {
	EnglishAdverbLexicalRelationsSchema,
	EnglishAdverbMorphologicalRelationsSchema,
} from "./parts/english-adverb-relations";

const EnglishAdverbSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdverbInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishAdverbLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishAdverbMorphologicalRelationsSchema,
	pos: "ADV",
});

export const EnglishAdverbInflectionSelectionSchema =
	EnglishAdverbSchemas.InflectionSelectionSchema;
export const EnglishAdverbLemmaSelectionSchema =
	EnglishAdverbSchemas.LemmaSelectionSchema;
export const EnglishAdverbStandardPartialSelectionSchema =
	EnglishAdverbSchemas.StandardPartialSelectionSchema;
export const EnglishAdverbStandardVariantSelectionSchema =
	EnglishAdverbSchemas.StandardVariantSelectionSchema;
export const EnglishAdverbTypoInflectionSelectionSchema =
	EnglishAdverbSchemas.TypoInflectionSelectionSchema;
export const EnglishAdverbTypoLemmaSelectionSchema =
	EnglishAdverbSchemas.TypoLemmaSelectionSchema;
export const EnglishAdverbTypoPartialSelectionSchema =
	EnglishAdverbSchemas.TypoPartialSelectionSchema;
export const EnglishAdverbTypoVariantSelectionSchema =
	EnglishAdverbSchemas.TypoVariantSelectionSchema;
export const EnglishAdverbLemmaSchema = EnglishAdverbSchemas.LemmaSchema;
