import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanSymbolInflectionalFeaturesSchema,
	GermanSymbolInherentFeaturesSchema,
} from "./parts/german-symbol-features";
import {
	GermanSymbolLexicalRelationsSchema,
	GermanSymbolMorphologicalRelationsSchema,
} from "./parts/german-symbol-relations";

const GermanSymbolSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanSymbolInherentFeaturesSchema,
	lexicalRelationsSchema: GermanSymbolLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanSymbolMorphologicalRelationsSchema,
	pos: "SYM",
});

export const GermanSymbolInflectionSelectionSchema =
	GermanSymbolSchemas.InflectionSelectionSchema;
export const GermanSymbolLemmaSelectionSchema =
	GermanSymbolSchemas.LemmaSelectionSchema;
export const GermanSymbolStandardPartialSelectionSchema =
	GermanSymbolSchemas.StandardPartialSelectionSchema;
export const GermanSymbolStandardVariantSelectionSchema =
	GermanSymbolSchemas.StandardVariantSelectionSchema;
export const GermanSymbolTypoInflectionSelectionSchema =
	GermanSymbolSchemas.TypoInflectionSelectionSchema;
export const GermanSymbolTypoLemmaSelectionSchema =
	GermanSymbolSchemas.TypoLemmaSelectionSchema;
export const GermanSymbolTypoPartialSelectionSchema =
	GermanSymbolSchemas.TypoPartialSelectionSchema;
export const GermanSymbolTypoVariantSelectionSchema =
	GermanSymbolSchemas.TypoVariantSelectionSchema;
export const GermanSymbolLemmaSchema = GermanSymbolSchemas.LemmaSchema;
