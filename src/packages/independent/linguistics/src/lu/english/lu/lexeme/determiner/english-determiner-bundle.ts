import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishDeterminerInflectionalFeaturesSchema,
	EnglishDeterminerInherentFeaturesSchema,
} from "./parts/english-determiner-features";
import {
	EnglishDeterminerLexicalRelationsSchema,
	EnglishDeterminerMorphologicalRelationsSchema,
} from "./parts/english-determiner-relations";

const EnglishDeterminerSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishDeterminerInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishDeterminerLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishDeterminerMorphologicalRelationsSchema,
	pos: "DET",
});

export const EnglishDeterminerInflectionSelectionSchema =
	EnglishDeterminerSchemas.InflectionSelectionSchema;
export const EnglishDeterminerLemmaSelectionSchema =
	EnglishDeterminerSchemas.LemmaSelectionSchema;
export const EnglishDeterminerStandardVariantSelectionSchema =
	EnglishDeterminerSchemas.StandardVariantSelectionSchema;
export const EnglishDeterminerTypoInflectionSelectionSchema =
	EnglishDeterminerSchemas.TypoInflectionSelectionSchema;
export const EnglishDeterminerTypoLemmaSelectionSchema =
	EnglishDeterminerSchemas.TypoLemmaSelectionSchema;
export const EnglishDeterminerTypoVariantSelectionSchema =
	EnglishDeterminerSchemas.TypoVariantSelectionSchema;
export const EnglishDeterminerLemmaSchema = EnglishDeterminerSchemas.LemmaSchema;
