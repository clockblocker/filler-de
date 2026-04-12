import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAdjectiveInflectionalFeaturesSchema,
	GermanAdjectiveInherentFeaturesSchema,
} from "./parts/german-adjective-features";
import {
	GermanAdjectiveLexicalRelationsSchema,
	GermanAdjectiveMorphologicalRelationsSchema,
} from "./parts/german-adjective-relations";

const GermanAdjectiveSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdjectiveInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdjectiveLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdjectiveMorphologicalRelationsSchema,
	pos: "ADJ",
});

export const GermanAdjectiveInflectionSelectionSchema =
	GermanAdjectiveSchemas.InflectionSelectionSchema;
export const GermanAdjectiveLemmaSelectionSchema =
	GermanAdjectiveSchemas.LemmaSelectionSchema;
export const GermanAdjectiveStandardPartialSelectionSchema =
	GermanAdjectiveSchemas.StandardPartialSelectionSchema;
export const GermanAdjectiveStandardVariantSelectionSchema =
	GermanAdjectiveSchemas.StandardVariantSelectionSchema;
export const GermanAdjectiveTypoInflectionSelectionSchema =
	GermanAdjectiveSchemas.TypoInflectionSelectionSchema;
export const GermanAdjectiveTypoLemmaSelectionSchema =
	GermanAdjectiveSchemas.TypoLemmaSelectionSchema;
export const GermanAdjectiveTypoPartialSelectionSchema =
	GermanAdjectiveSchemas.TypoPartialSelectionSchema;
export const GermanAdjectiveTypoVariantSelectionSchema =
	GermanAdjectiveSchemas.TypoVariantSelectionSchema;
export const GermanAdjectiveLemmaSchema = GermanAdjectiveSchemas.LemmaSchema;
