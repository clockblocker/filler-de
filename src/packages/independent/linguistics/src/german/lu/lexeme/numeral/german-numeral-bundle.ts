import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanNumeralInflectionalFeaturesSchema,
	GermanNumeralInherentFeaturesSchema,
} from "./parts/german-numeral-features";
import {
	GermanNumeralLexicalRelationsSchema,
	GermanNumeralMorphologicalRelationsSchema,
} from "./parts/german-numeral-relations";

const GermanNumeralSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanNumeralInherentFeaturesSchema,
	lexicalRelationsSchema: GermanNumeralLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanNumeralMorphologicalRelationsSchema,
	pos: "NUM",
});

export const GermanNumeralInflectionSelectionSchema =
	GermanNumeralSchemas.InflectionSelectionSchema;
export const GermanNumeralLemmaSelectionSchema =
	GermanNumeralSchemas.LemmaSelectionSchema;
export const GermanNumeralStandardPartialSelectionSchema =
	GermanNumeralSchemas.StandardPartialSelectionSchema;
export const GermanNumeralStandardVariantSelectionSchema =
	GermanNumeralSchemas.StandardVariantSelectionSchema;
export const GermanNumeralTypoInflectionSelectionSchema =
	GermanNumeralSchemas.TypoInflectionSelectionSchema;
export const GermanNumeralTypoLemmaSelectionSchema =
	GermanNumeralSchemas.TypoLemmaSelectionSchema;
export const GermanNumeralTypoPartialSelectionSchema =
	GermanNumeralSchemas.TypoPartialSelectionSchema;
export const GermanNumeralTypoVariantSelectionSchema =
	GermanNumeralSchemas.TypoVariantSelectionSchema;
export const GermanNumeralLemmaSchema = GermanNumeralSchemas.LemmaSchema;
