import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanAdverbInflectionalFeaturesSchema,
	GermanAdverbInherentFeaturesSchema,
} from "./parts/german-adverb-features";
import {
	GermanAdverbLexicalRelationsSchema,
	GermanAdverbMorphologicalRelationsSchema,
} from "./parts/german-adverb-relations";

const GermanAdverbSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdverbInherentFeaturesSchema,
	lexicalRelationsSchema: GermanAdverbLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanAdverbMorphologicalRelationsSchema,
	pos: "ADV",
});

export const GermanAdverbInflectionSelectionSchema =
	GermanAdverbSchemas.InflectionSelectionSchema;
export const GermanAdverbLemmaSelectionSchema =
	GermanAdverbSchemas.LemmaSelectionSchema;
export const GermanAdverbStandardVariantSelectionSchema =
	GermanAdverbSchemas.StandardVariantSelectionSchema;
export const GermanAdverbTypoInflectionSelectionSchema =
	GermanAdverbSchemas.TypoInflectionSelectionSchema;
export const GermanAdverbTypoLemmaSelectionSchema =
	GermanAdverbSchemas.TypoLemmaSelectionSchema;
export const GermanAdverbTypoVariantSelectionSchema =
	GermanAdverbSchemas.TypoVariantSelectionSchema;
export const GermanAdverbLemmaSchema = GermanAdverbSchemas.LemmaSchema;
