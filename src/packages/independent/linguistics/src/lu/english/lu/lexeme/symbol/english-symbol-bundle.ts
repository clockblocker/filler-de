import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishSymbolInflectionalFeaturesSchema,
	EnglishSymbolInherentFeaturesSchema,
} from "./parts/english-symbol-features";
import {
	EnglishSymbolLexicalRelationsSchema,
	EnglishSymbolMorphologicalRelationsSchema,
} from "./parts/english-symbol-relations";

const EnglishSymbolSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishSymbolInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishSymbolLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishSymbolMorphologicalRelationsSchema,
	pos: "SYM",
});

export const EnglishSymbolInflectionSelectionSchema =
	EnglishSymbolSchemas.InflectionSelectionSchema;
export const EnglishSymbolLemmaSelectionSchema =
	EnglishSymbolSchemas.LemmaSelectionSchema;
export const EnglishSymbolStandardVariantSelectionSchema =
	EnglishSymbolSchemas.StandardVariantSelectionSchema;
export const EnglishSymbolTypoInflectionSelectionSchema =
	EnglishSymbolSchemas.TypoInflectionSelectionSchema;
export const EnglishSymbolTypoLemmaSelectionSchema =
	EnglishSymbolSchemas.TypoLemmaSelectionSchema;
export const EnglishSymbolTypoVariantSelectionSchema =
	EnglishSymbolSchemas.TypoVariantSelectionSchema;
export const EnglishSymbolLemmaSchema = EnglishSymbolSchemas.LemmaSchema;
