import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import {
	GermanDeterminerInflectionalFeaturesSchema,
	GermanDeterminerInherentFeaturesSchema,
} from "./parts/german-determiner-features";
import {
	GermanDeterminerLexicalRelationsSchema,
	GermanDeterminerMorphologicalRelationsSchema,
} from "./parts/german-determiner-relations";

const GermanDeterminerSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanDeterminerInherentFeaturesSchema,
	lexicalRelationsSchema: GermanDeterminerLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanDeterminerMorphologicalRelationsSchema,
	pos: "DET",
});

export const GermanDeterminerInflectionSelectionSchema =
	GermanDeterminerSchemas.InflectionSelectionSchema;
export const GermanDeterminerLemmaSelectionSchema =
	GermanDeterminerSchemas.LemmaSelectionSchema;
export const GermanDeterminerStandardVariantSelectionSchema =
	GermanDeterminerSchemas.StandardVariantSelectionSchema;
export const GermanDeterminerTypoInflectionSelectionSchema =
	GermanDeterminerSchemas.TypoInflectionSelectionSchema;
export const GermanDeterminerTypoLemmaSelectionSchema =
	GermanDeterminerSchemas.TypoLemmaSelectionSchema;
export const GermanDeterminerTypoVariantSelectionSchema =
	GermanDeterminerSchemas.TypoVariantSelectionSchema;
export const GermanDeterminerLemmaSchema = GermanDeterminerSchemas.LemmaSchema;
