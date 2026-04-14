import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishNumeralInflectionalFeaturesSchema,
	EnglishNumeralInherentFeaturesSchema,
} from "./parts/english-numeral-features";
import {
	EnglishNumeralLexicalRelationsSchema,
	EnglishNumeralMorphologicalRelationsSchema,
} from "./parts/english-numeral-relations";

const EnglishNumeralSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishNumeralInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishNumeralLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishNumeralMorphologicalRelationsSchema,
	pos: "NUM",
});

export const EnglishNumeralInflectionSelectionSchema =
	EnglishNumeralSchemas.InflectionSelectionSchema;
export const EnglishNumeralLemmaSelectionSchema =
	EnglishNumeralSchemas.LemmaSelectionSchema;
export const EnglishNumeralStandardVariantSelectionSchema =
	EnglishNumeralSchemas.StandardVariantSelectionSchema;
export const EnglishNumeralTypoInflectionSelectionSchema =
	EnglishNumeralSchemas.TypoInflectionSelectionSchema;
export const EnglishNumeralTypoLemmaSelectionSchema =
	EnglishNumeralSchemas.TypoLemmaSelectionSchema;
export const EnglishNumeralTypoVariantSelectionSchema =
	EnglishNumeralSchemas.TypoVariantSelectionSchema;
export const EnglishNumeralLemmaSchema = EnglishNumeralSchemas.LemmaSchema;
