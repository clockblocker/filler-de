import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAdpositionInflectionalFeaturesSchema,
	GermanAdpositionInherentFeaturesSchema,
} from "./parts/german-adposition-features";
import {
	GermanAdpositionLexicalRelationsSchema,
	GermanAdpositionMorphologicalRelationsSchema,
} from "./parts/german-adposition-relations";

const GermanAdpositionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdpositionInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdpositionLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdpositionMorphologicalRelationsSchema,
	pos: "ADP",
});

export const GermanAdpositionInflectionSelectionSchema =
	GermanAdpositionSchemas.InflectionSelectionSchema;
export const GermanAdpositionLemmaSelectionSchema =
	GermanAdpositionSchemas.LemmaSelectionSchema;
export const GermanAdpositionStandardVariantSelectionSchema =
	GermanAdpositionSchemas.StandardVariantSelectionSchema;
export const GermanAdpositionTypoInflectionSelectionSchema =
	GermanAdpositionSchemas.TypoInflectionSelectionSchema;
export const GermanAdpositionTypoLemmaSelectionSchema =
	GermanAdpositionSchemas.TypoLemmaSelectionSchema;
export const GermanAdpositionTypoVariantSelectionSchema =
	GermanAdpositionSchemas.TypoVariantSelectionSchema;
export const GermanAdpositionLemmaSchema = GermanAdpositionSchemas.LemmaSchema;
